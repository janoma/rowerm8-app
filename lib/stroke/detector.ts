/**
 * Scalar stroke detector — state-machine edition (v2).
 *
 * Background
 * ----------
 * v1 was a faithful port of the Dart `StrokeDetector` snippet: a
 * rising-edge detector that fired the moment `value` crossed the dynamic
 * threshold upward. That logic is fundamentally too sensitive — any
 * single sample crossing the threshold counts as a stroke regardless of
 * what the rest of the pulse turns out to look like, so a 1-inch jiggle
 * after a refractory window passes was indistinguishable from a real
 * stroke.
 *
 * v2 keeps every public concept of v1 — the dynamic-threshold + baseline
 * EMA pair (Dart's `updateBaseline` / `updateDynamicThreshold`), the
 * refractory window (`minStrokeGapMs`), the cadence smoother — but
 * re-frames detection as a candidate state machine so each pulse is
 * evaluated *as a whole*, not at the instant it crosses upward.
 *
 * State machine (per sample, before baseline / threshold updates run)
 * -----------------------------------------------------------------
 * The detector is in one of two phases: `IDLE` and `ARMED`. A third
 * conceptual phase `END_OF_DRIVE` is evaluated within a single sample of
 * leaving `ARMED` (it is never a held state).
 *
 *   IDLE
 *     on  value ≥ armThreshold:       open candidate, → ARMED
 *
 *   ARMED  (a candidate stroke is in progress)
 *     update candidatePeak / candidatePeakMs / candidateImpulse
 *     on  value < releaseThreshold:   cancel candidate (jiggle), → IDLE
 *     on  value falling AND
 *         value < baseline + 0.5 · candidatePeak:
 *                                      → END_OF_DRIVE
 *
 *   END_OF_DRIVE  (single-sample evaluation, then → IDLE)
 *     fire stroke iff
 *         (peakMs − lastStrokeMs) > minStrokeGapMs    (refractory)
 *       AND candidatePeak ≥ threshold                  (peak gate)
 *       AND (peakMs − candidateStartMs) ≥ minDriveDurationMs
 *       AND candidateImpulse ≥ minStrokeImpulse
 *
 *     The stroke is **timestamped at peakMs** (not end-of-drive), so
 *     cadence remains the canonical peak-to-peak interval.
 *
 * Where v1 logic carries over
 * ---------------------------
 *   - The baseline EMA gate (`value < 1.15 · threshold`) is unchanged.
 *   - The asymmetric `max(0, value − baseline)` deviation feeding the
 *     threshold EMA is unchanged.
 *   - The cadence smoother (EMA on inter-peak gap → SPM) is unchanged.
 *   - The `arm/release` thresholds derive from the dynamic threshold so
 *     the detector continues to adapt as effort changes.
 *
 * Pure: no haptics, no globals, no I/O. Same `StrokeDetector` interface
 * as v1 so the surrounding code (`StrokeSession`, hook, UI) is
 * unaffected.
 */

import type {
  StrokeDetectorConfig,
  StrokeDetectorState,
  StrokeUpdateResult,
} from "./types";

export const DEFAULT_DETECTOR_CONFIG: StrokeDetectorConfig = {
  baselineAlpha: 0.01,
  thresholdAlpha: 0.1,
  deviationScale: 1.2,
  thresholdFloor: 0.5,
  thresholdCeiling: Number.POSITIVE_INFINITY,
  minStrokeGapMs: 1000,
  cadenceEmaAlpha: 0.5,
  initialThreshold: 0.5,
  initialCadenceSpm: 20,
  baselineUpdateBelowFactor: 1.15,
  // v2 gates — see `StrokeDetectorConfig` field comments for rationale.
  armThresholdFactor: 0.5,
  releaseThresholdFactor: 0.4,
  minDriveDurationMs: 200,
  minStrokeImpulse: 0.5,
};

export type StrokeDetector = {
  /**
   * Feed one sample. Returns the detector's view of the world after the
   * sample is processed. `strokeJustDetected` is `true` only on the
   * end-of-drive sample of a fully-gated candidate; the stroke is
   * timestamped at the candidate's peak, not at this sample.
   */
  update: (value: number, timestampMs: number) => StrokeUpdateResult;
  /** Forget all internal state and return to the seeded configuration. */
  reset: () => void;
  /** Snapshot of the current internal state. */
  getState: () => StrokeDetectorState;
};

/**
 * Construct a fresh detector. Caller-supplied `config` is merged on top of
 * {@link DEFAULT_DETECTOR_CONFIG}, so partial overrides are fine.
 */
export function createStrokeDetector(
  config: Partial<StrokeDetectorConfig> = {},
): StrokeDetector {
  const cfg: StrokeDetectorConfig = { ...DEFAULT_DETECTOR_CONFIG, ...config };

  const initial: StrokeDetectorState = {
    baseline: 0,
    threshold: cfg.initialThreshold,
    previousValue: 0,
    lastStrokeTimeMs: null,
    strokeCount: 0,
    cadenceSpm: cfg.initialCadenceSpm,
    instantCadenceSpm: 0,
    phase: "IDLE",
    candidateStartMs: null,
    candidatePeak: 0,
    candidatePeakMs: null,
    candidateImpulse: 0,
    candidateArmThreshold: cfg.initialThreshold,
    lastSampleMs: null,
  };

  let state: StrokeDetectorState = { ...initial };

  function reset(): void {
    state = { ...initial };
  }

  function clearCandidate(): void {
    state.phase = "IDLE";
    state.candidateStartMs = null;
    state.candidatePeak = 0;
    state.candidatePeakMs = null;
    state.candidateImpulse = 0;
    state.candidateArmThreshold = state.threshold;
  }

  function update(value: number, timestampMs: number): StrokeUpdateResult {
    // dt for impulse integration. First-ever sample contributes zero
    // impulse, which is fine because we cannot integrate with no prior
    // timestamp.
    const dtSec =
      state.lastSampleMs == null
        ? 0
        : (timestampMs - state.lastSampleMs) / 1000;

    // ARM uses the live threshold (because we're deciding to enter
    // ARMED right now). RELEASE uses the snapshot taken at arm time
    // (because the dynamic threshold can ratchet upward inside the
    // ARMED phase as we accumulate samples; using the live value would
    // cause the still-growing pulse to be retroactively cancelled).
    const armThreshold = cfg.armThresholdFactor * state.threshold;
    const releaseThreshold =
      cfg.releaseThresholdFactor * state.candidateArmThreshold;
    const deviation = value - state.baseline;
    const positiveDeviation = Math.max(0, deviation);

    let strokeJustDetected = false;

    // --- State machine ----------------------------------------------------
    if (state.phase === "IDLE") {
      if (value >= armThreshold) {
        // Open a new candidate. Seed peak / impulse with this sample
        // and snapshot the threshold so the bigEnough gate at
        // end-of-drive doesn't move under us as the dynamic threshold
        // ratchets through the ARMED phase.
        state.phase = "ARMED";
        state.candidateStartMs = timestampMs;
        state.candidatePeak = positiveDeviation;
        state.candidatePeakMs = timestampMs;
        state.candidateImpulse = positiveDeviation * dtSec;
        state.candidateArmThreshold = state.threshold;
      }
    } else {
      // ARMED: accumulate, then check for cancel / end-of-drive.
      if (deviation > state.candidatePeak) {
        state.candidatePeak = deviation;
        state.candidatePeakMs = timestampMs;
      }
      state.candidateImpulse += positiveDeviation * dtSec;

      const isFalling = value < state.previousValue;
      const halfPeakAboveBaseline = state.candidatePeak * 0.5;

      if (value < releaseThreshold) {
        // Candidate fizzled — likely a transient bump. No stroke fires.
        clearCandidate();
      } else if (isFalling && deviation < halfPeakAboveBaseline) {
        // END_OF_DRIVE: evaluate gates, fire iff all pass, then go IDLE.
        const peakMs = state.candidatePeakMs ?? timestampMs;
        const startMs = state.candidateStartMs ?? timestampMs;
        const driveDurationMs = peakMs - startMs;
        const lastTs = state.lastStrokeTimeMs;
        const inGap = lastTs == null || peakMs - lastTs > cfg.minStrokeGapMs;
        // Use the threshold snapshotted at arm-time, not the live
        // (potentially-ratcheted) one. Otherwise a candidate that armed
        // legitimately could be retroactively rejected because the
        // threshold climbed above its peak during the ARMED phase.
        const bigEnough = state.candidatePeak >= state.candidateArmThreshold;
        const longEnough = driveDurationMs >= cfg.minDriveDurationMs;
        const punchy = state.candidateImpulse >= cfg.minStrokeImpulse;

        if (inGap && bigEnough && longEnough && punchy) {
          strokeJustDetected = true;
          state.strokeCount += 1;

          // Cadence: stroke timestamps are peak-to-peak, not end-to-end.
          // Pre-stroke we have no prior peak time, so leave cadence on
          // its seed until the second stroke gives us a real interval.
          if (lastTs != null) {
            const gapSeconds = (peakMs - lastTs) / 1000;
            if (gapSeconds > 0) {
              const instant = 60 / gapSeconds;
              state.instantCadenceSpm = instant;
              state.cadenceSpm =
                (1 - cfg.cadenceEmaAlpha) * state.cadenceSpm +
                cfg.cadenceEmaAlpha * instant;
            }
          }
          state.lastStrokeTimeMs = peakMs;
        }
        clearCandidate();
      }
    }

    // --- Baseline / threshold updates (run every sample) ------------------
    //
    // Order matches v1: state machine sees start-of-sample baseline /
    // threshold; then we advance the EMAs for the next sample. The
    // baseline gate (`value < 1.15 · threshold`) is unchanged from the
    // Dart snippet — it suppresses baseline drift while a stroke pulse
    // is in flight.
    if (value < cfg.baselineUpdateBelowFactor * state.threshold) {
      state.baseline =
        state.baseline === 0
          ? value
          : (1 - cfg.baselineAlpha) * state.baseline +
            cfg.baselineAlpha * value;
    }

    // Threshold: asymmetric EMA toward `deviationScale · positiveDeviation`,
    // clamped between the configured floor and ceiling. The
    // `max(0, ...)` clamp is what makes peaks raise the threshold while
    // troughs only let it decay through the EMA — same property the v1
    // implementation had.
    const target = positiveDeviation * cfg.deviationScale;
    const next =
      (1 - cfg.thresholdAlpha) * state.threshold + cfg.thresholdAlpha * target;
    state.threshold = clamp(next, cfg.thresholdFloor, cfg.thresholdCeiling);

    state.previousValue = value;
    state.lastSampleMs = timestampMs;

    return {
      strokeJustDetected,
      strokeCount: state.strokeCount,
      cadenceSpm: state.cadenceSpm,
      instantCadenceSpm: state.instantCadenceSpm,
      threshold: state.threshold,
      baseline: state.baseline,
    };
  }

  function getState(): StrokeDetectorState {
    return { ...state };
  }

  return { update, reset, getState };
}

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) {
    return lo;
  }
  if (value > hi) {
    return hi;
  }
  return value;
}
