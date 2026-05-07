/**
 * Scalar peak detector for rowing strokes.
 *
 * This is a faithful port of the `StrokeDetector` class in
 * `strokedetectionsnippet.dart`, with three deliberate deviations:
 *
 *   1. Pure: no haptics, no globals. The Dart `Vibration.vibrate(...)` call
 *      becomes the boolean `strokeJustDetected` field on the per-sample
 *      result so the caller can render visual feedback (or not).
 *   2. Self-contained: every Dart "external" (`beta`, `thrspeed`, `scale`,
 *      `floor`, `ceiling`, the cadence EMA alpha, the seed values) is a
 *      typed config field with a default in {@link DEFAULT_DETECTOR_CONFIG}.
 *   3. Wired: the Dart `detectStroke` did not actually invoke
 *      `updateBaseline` / `updateDynamicThreshold` — those calls were left
 *      to the surrounding program. Here both updates run on every sample,
 *      gated as follows:
 *        - Baseline updates while `value < 1.15 * threshold` (the original
 *          gate from `updateBaseline`).
 *        - Threshold updates on every sample except the trigger sample.
 *          We deliberately do NOT additionally gate this on a
 *          "post-refractory" window — that path is self-defeating because
 *          a single missed stroke would prevent the refractory window
 *          from ever restarting and let the threshold climb unbounded.
 *          The asymmetric `max(0, deviation)` clamp plus the floor clamp
 *          already implement the "peaks raise, troughs cannot lower
 *          faster than EMA decay" property the author was after.
 *
 * The math, the sign asymmetry, and the EMA/clamp behaviour are unchanged
 * from the Dart helpers.
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
};

export type StrokeDetector = {
  /**
   * Feed one sample. Returns the detector's view of the world after the
   * sample is processed.
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
  };

  let state: StrokeDetectorState = { ...initial };

  function reset(): void {
    state = { ...initial };
  }

  function update(value: number, timestampMs: number): StrokeUpdateResult {
    // Step 1: detect the upward threshold crossing first, *before* any
    // baseline/threshold updates. The Dart snippet checks the crossing
    // against the threshold value as it was at the *start* of this sample,
    // which is what `state.threshold` still holds.
    const crossedUp =
      state.previousValue < state.threshold && value >= state.threshold;
    const lastTs = state.lastStrokeTimeMs;
    const strokeGapMs = lastTs == null ? Infinity : timestampMs - lastTs;
    const pastGap = strokeGapMs > cfg.minStrokeGapMs;
    const triggered = crossedUp && pastGap;

    let strokeJustDetected = false;
    if (triggered) {
      strokeJustDetected = true;
      state.strokeCount += 1;

      // Cadence is "if I keep stroking at this rate, how many strokes per
      // minute is that". The first stroke has no previous time to compare
      // against, so we leave cadence on its seed value until the second one
      // gives us a real gap.
      if (lastTs != null) {
        const gapSeconds = strokeGapMs / 1000;
        if (gapSeconds > 0) {
          const instant = 60 / gapSeconds;
          state.instantCadenceSpm = instant;
          state.cadenceSpm =
            (1 - cfg.cadenceEmaAlpha) * state.cadenceSpm +
            cfg.cadenceEmaAlpha * instant;
        }
      }
      state.lastStrokeTimeMs = timestampMs;
    }

    // Step 2: update the baseline. The Dart gate is `value < 1.15 *
    // threshold`, i.e. "we're well below where the next stroke would
    // trigger". The first ever update seeds with the raw value to avoid
    // leaving the baseline pinned at 0 forever (which would skew the
    // first deviation calc).
    if (value < cfg.baselineUpdateBelowFactor * state.threshold) {
      state.baseline =
        state.baseline === 0
          ? value
          : (1 - cfg.baselineAlpha) * state.baseline +
            cfg.baselineAlpha * value;
    }

    // Step 3: update the dynamic threshold on every non-trigger sample.
    //
    // The Dart inline comment "THIS SHOULD UPDATE ONLY DURING RECOVERY!!
    // WHEN IN STROKEGAP !!" was the author's intent for the surrounding
    // (Dart-side) wiring, but pinning the update to the post-refractory
    // window has a self-defeating failure mode: if a stroke is ever
    // missed, the refractory window never restarts, the threshold can
    // climb unbounded across successive cycles, and recovery becomes
    // impossible. The asymmetric `max(0, deviation)` clamp already does
    // the work the author was after — peaks raise the threshold, troughs
    // can only let it decay gently via the EMA. The floor clamp prevents
    // the EMA from ever pulling the trigger bar below the configured
    // noise floor. We exclude only the trigger sample itself: counting
    // its own deviation would make the algorithm self-cancelling on the
    // very first stroke.
    if (!triggered) {
      const deviation = Math.max(0, value - state.baseline);
      const target = deviation * cfg.deviationScale;
      const next =
        (1 - cfg.thresholdAlpha) * state.threshold +
        cfg.thresholdAlpha * target;
      state.threshold = clamp(next, cfg.thresholdFloor, cfg.thresholdCeiling);
    }

    state.previousValue = value;

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
