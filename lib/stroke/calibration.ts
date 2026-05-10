/**
 * Cadence calibration gate.
 *
 * Replaces the v1 fixed-stroke gate (`CALIBRATION_STROKE_COUNT = 5`)
 * with a rhythm-quality criterion the user doesn't see counting down.
 * The function is a pure switch over `(strokeCount, gap CV, elapsed
 * since first stroke)` — no clocks, no React, no I/O — so it can be
 * unit-tested deterministically against synthetic gap streams.
 *
 * State machine
 * -------------
 *   idle         no strokes detected yet
 *   calibrating  ≥1 stroke seen, but criterion not yet satisfied
 *   calibrated   either the rhythm-quality criterion fired, or the
 *                hard cap kicked in
 *
 * Once `calibrated` is asserted by the caller it should latch — a
 * later run of bumpy strokes shouldn't drop us back into calibrating.
 * That latch lives in the consumer (`useStrokeSession`) so this module
 * stays pure.
 *
 * Rhythm-quality criterion
 * ------------------------
 *  - Minimum {@link CALIBRATION_CONFIG.minStrokes} detected strokes
 *    (avoids one-stroke-wonders).
 *  - Coefficient of variation (CV) of the most recent
 *    {@link CALIBRATION_CONFIG.gapWindow} stroke-gap intervals
 *    ≤ {@link CALIBRATION_CONFIG.cvThreshold}.
 *
 * CV = stddev(gaps) / mean(gaps). 0.13 ≈ ±13% gap-to-gap variability;
 * tighter than the naïve 0.15 because at 24 spm one wobbly stroke
 * already pushes a 4-sample CV past 0.15.
 *
 * Hard cap
 * --------
 * Force `calibrated = true` after either:
 *   - {@link CALIBRATION_CONFIG.hardCapStrokes} detected strokes, or
 *   - {@link CALIBRATION_CONFIG.hardCapMs} elapsed since the first
 *     stroke,
 * whichever first. This is the safety net for a user whose rhythm
 * never settles — calibration goes live and the cadence display
 * updates regardless of CV.
 */

export type CalibrationState = "idle" | "calibrating" | "calibrated";

export const CALIBRATION_CONFIG = {
  minStrokes: 3,
  gapWindow: 4,
  cvThreshold: 0.13,
  hardCapStrokes: 12,
  hardCapMs: 60_000,
} as const;

export type CalibrationStatusInput = {
  /** Cumulative number of strokes detected since session start. */
  strokeCount: number;
  /**
   * Most recent peak-to-peak stroke gaps, in milliseconds, oldest
   * first. Only the trailing {@link CALIBRATION_CONFIG.gapWindow}
   * entries are inspected by the CV computation; passing more is fine
   * and passing fewer just means the criterion can't fire yet.
   */
  recentGapsMs: readonly number[];
  /**
   * Wall-clock timestamp of the first stroke this session. `null`
   * before the first stroke (state is then trivially `idle`).
   */
  firstStrokeAtMs: number | null;
  /** Wall-clock now, used only for the elapsed-time hard cap. */
  nowMs: number;
};

/**
 * Compute the calibration state for the supplied snapshot. See module
 * docstring for the rules.
 *
 * Pure: same inputs → same output. The caller is responsible for
 * latching `calibrated` once asserted.
 */
export function calibrationStatus(
  input: CalibrationStatusInput,
): CalibrationState {
  const { strokeCount, recentGapsMs, firstStrokeAtMs, nowMs } = input;

  if (strokeCount <= 0 || firstStrokeAtMs == null) {
    return "idle";
  }

  // Hard cap on stroke count — fires regardless of CV.
  if (strokeCount >= CALIBRATION_CONFIG.hardCapStrokes) {
    return "calibrated";
  }

  // Hard cap on wall-clock elapsed since first stroke.
  if (
    Number.isFinite(nowMs) &&
    Number.isFinite(firstStrokeAtMs) &&
    nowMs - firstStrokeAtMs >= CALIBRATION_CONFIG.hardCapMs
  ) {
    return "calibrated";
  }

  // Rhythm-quality criterion: CV of the trailing gap window.
  if (strokeCount >= CALIBRATION_CONFIG.minStrokes) {
    const window = recentGapsMs.slice(-CALIBRATION_CONFIG.gapWindow);
    if (window.length >= 2) {
      const cv = coefficientOfVariation(window);
      if (cv != null && cv <= CALIBRATION_CONFIG.cvThreshold) {
        return "calibrated";
      }
    }
  }

  return "calibrating";
}

/**
 * Population-stddev / mean of a non-empty numeric series. Returns
 * `null` for empty inputs, single-element inputs (no variance to
 * speak of), zero/negative means, or non-finite outputs. Population
 * stddev (rather than sample) is the right choice here because the
 * window is the entire signal we're judging — there's no implicit
 * "larger population" we're estimating from a sample.
 */
function coefficientOfVariation(values: readonly number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      return null;
    }
    sum += v;
  }
  const mean = sum / values.length;
  if (mean <= 0) {
    return null;
  }
  let sqSum = 0;
  for (const v of values) {
    const d = v - mean;
    sqSum += d * d;
  }
  const stddev = Math.sqrt(sqSum / values.length);
  const cv = stddev / mean;
  return Number.isFinite(cv) ? cv : null;
}
