/**
 * Shared types for the stroke detection pipeline.
 *
 * The pipeline is a pure data path:
 *   AccelSample (3D) -> Projector -> scalar -> StrokeDetector -> StrokeUpdateResult
 *                                                              -> StrokeSession -> SessionMetrics
 *
 * Every layer is a small, allocation-light, deterministic state machine that
 * exposes its internal state through `getState()` so tests can poke at it
 * without monkeypatching globals.
 */

/**
 * 3-axis acceleration sample in m/s^2. Mirrors the shape of
 * {@link import("@/hooks/use-accelerometer-stream").AccelerometerSample} but
 * we redeclare it here so `lib/stroke/` does not depend on React/Expo and can
 * be tested under plain Node via `ts-jest`.
 */
export type Vec3Sample = {
  x: number;
  y: number;
  z: number;
};

/**
 * Euler attitude in degrees (ZYX intrinsic — the WitMotion convention).
 * See `lib/stroke/gravity.ts` for the rotation matrix derivation.
 */
export type Angle = {
  roll: number;
  pitch: number;
  yaw: number;
};

/**
 * A `Vec3Sample` plus the optional sensor-fusion fields some IMUs emit on
 * device. Today only `angle` is consumed, by `handleAxisProjector` for
 * gravity subtraction. The phone path leaves it `undefined`.
 *
 * Projectors that only need x/y/z keep working unchanged because every
 * `Vec3Sample` is structurally a `MotionSample` with no optional fields set.
 */
export type MotionSample = Vec3Sample & {
  angle?: Angle;
};

/**
 * A 3D-to-1D projector turns the live `MotionSample` stream into the scalar
 * effort signal the detector expects. Implementations may be stateful (PCA
 * needs a rolling buffer; the magnitude projector needs an EMA "rest" value)
 * but must not perform any I/O.
 */
export type Projector = {
  /** Project one sample at the given timestamp (ms, monotonic). */
  project: (sample: MotionSample, timestampMs: number) => number;
  /** Forget all internal state. */
  reset: () => void;
};

/**
 * Tunable parameters of the scalar peak detector. All defaults live in
 * `DEFAULT_DETECTOR_CONFIG`; the field comments document what the Dart
 * snippet called the same knob.
 */
export type StrokeDetectorConfig = {
  /** Baseline EMA coefficient (Dart: `beta`). Slow tracks drift / DC noise. */
  baselineAlpha: number;
  /** Threshold EMA coefficient (Dart: `thrspeed`). Faster than `baselineAlpha`
   * so the threshold adapts to changes in effort. */
  thresholdAlpha: number;
  /** Deviation scale factor (Dart: `scale`). A value of 1.2 means "the next
   * stroke must clear baseline by 20% more than the recent peak deviation". */
  deviationScale: number;
  /** Lower clamp for the threshold (Dart: `floor`). Prevents the detector from
   * triggering on tiny noise spikes when the user is at rest. */
  thresholdFloor: number;
  /** Upper clamp for the threshold (Dart: `ceiling`). */
  thresholdCeiling: number;
  /** Minimum gap between detected strokes, in milliseconds (Dart:
   * `minStrokeGapMs`). The refractory window is what prevents a single peak
   * from triggering twice when the signal wobbles around the threshold. */
  minStrokeGapMs: number;
  /** EMA alpha for the cadence smoother. The Dart snippet hard-coded `0.5`
   * inline on line 104. */
  cadenceEmaAlpha: number;
  /** Initial value of the dynamic threshold. Defaults to `thresholdFloor`. */
  initialThreshold: number;
  /** Initial cadence seed in strokes per minute (Dart: `_currentSlider3Value`).
   * Used only as the EMA seed for the very first stroke. */
  initialCadenceSpm: number;
  /** Multiplier on the current threshold below which the baseline EMA is
   * allowed to update. The Dart code uses `1.15` (15% headroom). */
  baselineUpdateBelowFactor: number;
  /**
   * Fraction of the dynamic threshold a sample must clear to *open* a
   * candidate stroke window (state goes IDLE → ARMED). Default 0.5 means
   * "half the dynamic threshold opens the window"; the candidate is then
   * still subject to peak / duration / impulse gates at end-of-drive.
   */
  armThresholdFactor: number;
  /**
   * Fraction of the dynamic threshold below which an ARMED candidate is
   * cancelled (no end-of-drive evaluation). Slightly lower than
   * `armThresholdFactor` to give us a small hysteresis band so a single
   * noisy sample doesn't rapidly bounce IDLE↔ARMED.
   */
  releaseThresholdFactor: number;
  /**
   * Minimum drive duration (peak − arm in ms) for a candidate to count as
   * a stroke. Rejects sub-200 ms blips that the rising-edge detector
   * would have happily triggered on. Real rowing drives are 300–700 ms,
   * comfortably above this floor.
   */
  minDriveDurationMs: number;
  /**
   * Minimum integrated impulse `∫ max(0, value − baseline) dt` (units:
   * `value-units · seconds`) for a candidate to count. With the
   * `handleAxisProjector` (linear acceleration in m/s²) this is roughly
   * the velocity change along the pull axis, so the unit is m/s.
   * Empirical placeholder; rejects small jiggles even if they pass the
   * peak gate.
   */
  minStrokeImpulse: number;
};

/**
 * Phase of the v2 stroke detector's per-sample state machine.
 *
 *   - `IDLE`: no active candidate; waiting for `value ≥ armThreshold`.
 *   - `ARMED`: a candidate is being collected (peak / impulse accumulators
 *     are live). The candidate is committed when the drive ends, or
 *     cancelled when value drops below `releaseThreshold`.
 *
 * `END_OF_DRIVE` is not a held state — it is evaluated within a single
 * sample of leaving `ARMED` and immediately transitions back to `IDLE`.
 */
export type StrokeDetectorPhase = "IDLE" | "ARMED";

/** Mutable state of the scalar peak detector, exposed for tests / debugging. */
export type StrokeDetectorState = {
  baseline: number;
  threshold: number;
  previousValue: number;
  lastStrokeTimeMs: number | null;
  strokeCount: number;
  /** Smoothed cadence in strokes per minute. */
  cadenceSpm: number;
  /** Most recent unsmoothed cadence sample. */
  instantCadenceSpm: number;
  /** Current phase of the candidate state machine. */
  phase: StrokeDetectorPhase;
  /** Timestamp (ms) at which the current ARMED candidate started. */
  candidateStartMs: number | null;
  /** Maximum `value − baseline` observed during the current candidate. */
  candidatePeak: number;
  /** Timestamp (ms) of the sample that produced `candidatePeak`. */
  candidatePeakMs: number | null;
  /** Integrated impulse `∫ max(0, value − baseline) dt` for the current
   * candidate, in `value-units · seconds`. */
  candidateImpulse: number;
  /** Snapshot of the dynamic threshold at the moment the candidate
   * armed. Used by the `bigEnough` end-of-drive gate so a threshold that
   * keeps climbing during the ARMED phase can't retroactively reject a
   * peak we already armed on. */
  candidateArmThreshold: number;
  /** Timestamp (ms) of the most recent sample seen, for `dt` integration. */
  lastSampleMs: number | null;
};

/** Per-sample output of the detector. */
export type StrokeUpdateResult = {
  /** True iff this sample triggered a new stroke. Rising-edge only. */
  strokeJustDetected: boolean;
  /** Total strokes counted since the last `reset()`. */
  strokeCount: number;
  /** Smoothed cadence (strokes/min). Equals `previous smoothed value` when no
   * stroke just fired. */
  cadenceSpm: number;
  /** Unsmoothed cadence derived from the last two stroke timestamps. */
  instantCadenceSpm: number;
  /** Current dynamic threshold after this sample. */
  threshold: number;
  /** Current baseline after this sample. */
  baseline: number;
};

/** Minimal 3x3 symmetric matrix store used by the PCA projector. */
export type SymMat3 = {
  xx: number;
  yy: number;
  zz: number;
  xy: number;
  xz: number;
  yz: number;
};

/** Aggregated metrics emitted by `StrokeSession.getMetrics()`. */
export type SessionMetrics = {
  /** Total strokes since session start. */
  strokeCount: number;
  /** Smoothed cadence (strokes per minute) — what UIs typically display. */
  cadenceSpm: number;
  /** Unsmoothed cadence from the most recent inter-stroke gap. Useful for
   * debug overlays; jittery for a single-sample display. */
  instantCadenceSpm: number;
  /** Estimated boat speed in m/s, derived from cadence and a calibration
   * constant. Zero before the first stroke. */
  boatSpeedMps: number;
  /** Pace in seconds per 500m, derived from `boatSpeedMps`. Returns
   * `Infinity` until the first stroke (renders as `—` via `formatPace`). */
  paceSecondsPer500m: number;
  /** Wall-clock seconds since the session started receiving samples. */
  elapsedSeconds: number;
  /** Current dynamic threshold from the underlying detector. */
  threshold: number;
  /** Current baseline from the underlying detector. */
  baseline: number;
  /** True once at least one sample has been processed. */
  isReady: boolean;
};
