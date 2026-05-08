/**
 * StrokeSession — composes the 3D projector with the scalar peak detector
 * and tracks session-level state (elapsed time, derived pace estimate) so
 * the React layer only has to read a single struct.
 *
 * Pure: no I/O, no React, no platform clocks. The caller is responsible for
 * supplying timestamps so tests can drive deterministic time and the hook
 * can use the same `Date.now()` it uses for sample arrival.
 */

import { createStrokeDetector, DEFAULT_DETECTOR_CONFIG } from "./detector";
import type { StrokeDetector } from "./detector";
import { estimateBoatSpeedMps, estimatePaceSecondsPer500m } from "./pace";
import type { PaceEstimateOptions } from "./pace";
import { magnitudeProjector } from "./projector";
import type {
  MotionSample,
  Projector,
  SessionMetrics,
  StrokeDetectorConfig,
} from "./types";

export type StrokeSessionConfig = {
  /** Override any subset of detector tuning. */
  detector?: Partial<StrokeDetectorConfig>;
  /** Pace estimation options (e.g. per-user `metersPerStroke`). */
  pace?: PaceEstimateOptions;
};

export type StrokeSession = {
  /**
   * Feed one sample. Accepts either a plain `Vec3Sample` (phone path) or
   * a `MotionSample` enriched with optional sensor-fusion fields (BLE
   * path); the projector decides which fields it cares about.
   */
  update: (sample: MotionSample, timestampMs: number) => SessionMetrics;
  /** Most recent metrics snapshot without consuming a sample. */
  getMetrics: () => SessionMetrics;
  /** Forget all internal state and return to the seeded configuration. */
  reset: () => void;
  /** Direct access to the underlying detector — handy for tests / debug. */
  detector: StrokeDetector;
};

const ZERO_METRICS: SessionMetrics = {
  strokeCount: 0,
  cadenceSpm: DEFAULT_DETECTOR_CONFIG.initialCadenceSpm,
  instantCadenceSpm: 0,
  boatSpeedMps: 0,
  paceSecondsPer500m: Number.POSITIVE_INFINITY,
  elapsedSeconds: 0,
  threshold: DEFAULT_DETECTOR_CONFIG.initialThreshold,
  baseline: 0,
  isReady: false,
};

/**
 * Build a session that pulls each sample through `projector` and feeds the
 * scalar into a `StrokeDetector`. Defaults to {@link magnitudeProjector}
 * since it works under any orientation; swap in `pcaProjector()` once the
 * sensor is mounted statically.
 */
export function createStrokeSession(
  projector: Projector = magnitudeProjector(),
  config: StrokeSessionConfig = {},
): StrokeSession {
  const detector = createStrokeDetector(config.detector);
  let firstSampleMs: number | null = null;
  let lastMetrics: SessionMetrics = { ...ZERO_METRICS };

  function reset(): void {
    detector.reset();
    projector.reset();
    firstSampleMs = null;
    lastMetrics = { ...ZERO_METRICS };
  }

  function update(sample: MotionSample, timestampMs: number): SessionMetrics {
    if (firstSampleMs == null) {
      firstSampleMs = timestampMs;
    }
    // Forward the full sample (including any optional `angle` field) to
    // the projector. Projectors that only need x/y/z ignore the rest.
    const value = projector.project(sample, timestampMs);
    const result = detector.update(value, timestampMs);

    const elapsedSeconds = Math.max(0, (timestampMs - firstSampleMs) / 1000);
    // Pre-stroke we deliberately leave cadence at its seed so the UI doesn't
    // flash a fake cadence reading; pace stays at Infinity (renders as "—").
    const hasReceivedStrokes = result.strokeCount > 0;
    const cadenceForPace = hasReceivedStrokes ? result.cadenceSpm : 0;

    lastMetrics = {
      strokeCount: result.strokeCount,
      cadenceSpm: hasReceivedStrokes
        ? result.cadenceSpm
        : DEFAULT_DETECTOR_CONFIG.initialCadenceSpm,
      instantCadenceSpm: result.instantCadenceSpm,
      boatSpeedMps: estimateBoatSpeedMps(cadenceForPace, config.pace),
      paceSecondsPer500m: estimatePaceSecondsPer500m(
        cadenceForPace,
        config.pace,
      ),
      elapsedSeconds,
      threshold: result.threshold,
      baseline: result.baseline,
      isReady: true,
    };
    return lastMetrics;
  }

  return {
    update,
    getMetrics: () => lastMetrics,
    reset,
    detector,
  };
}
