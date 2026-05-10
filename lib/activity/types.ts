/**
 * Public types for the activity recorder + storage layer.
 *
 * Pure data only — no React, no FIT SDK, no expo-file-system. The recorder
 * speaks these types, the FIT writer translates them into FIT messages, and
 * the storage layer persists summaries + the FIT bytes.
 */

/** A snapshot of live metrics taken once per second by {@link ActivityRecorder.tick}. */
export type RecordSnapshot = {
  /** Seconds since the recorder was started. */
  elapsedS: number;
  /** Smoothed cadence in strokes per minute (0 before the first stroke). */
  cadenceSpm: number;
  /**
   * Pace in seconds per 500 m. May be `Number.POSITIVE_INFINITY` before
   * the first stroke; consumers should treat that as "no pace yet".
   */
  paceSecondsPer500m: number;
  /** Cumulative stroke count at this point. */
  strokeCount: number;
  /** Heart rate in bpm at this point, or null if no HR source is connected. */
  heartRateBpm: number | null;
  /**
   * Cumulative HR-derived calorie estimate at this point, in kcal.
   * `null` when the caller hasn't supplied a value (no HR has ever
   * been seen, or the screen hasn't wired calorie integration yet).
   * The recorder itself is a pure aggregator — see `lib/energy/calories.ts`
   * for the integrator that feeds this field.
   */
  caloriesKcal: number | null;
};

/** A single stroke event emitted via {@link ActivityRecorder.markStroke}. */
export type StrokeEvent = {
  /** Seconds since the recorder was started. */
  elapsedS: number;
  /** Cadence reading at the moment the stroke was detected. */
  cadenceSpm: number;
};

/** Aggregated, display-friendly numbers computed at {@link ActivityRecorder.finish}. */
export type ActivitySummary = {
  /** Wall-clock start time in epoch ms. */
  startedAtMs: number;
  /** Wall-clock end time in epoch ms. */
  endedAtMs: number;
  /**
   * Moving duration of the session in seconds. Pause windows are
   * subtracted, so this represents the time the user was actually
   * rowing. The wall-clock duration is `(endedAtMs - startedAtMs) / 1000`.
   */
  durationS: number;
  /** Total stroke count over the session. */
  strokeCount: number;
  /** Mean cadence across all snapshots that observed actual rowing (cadence > 0). */
  avgCadenceSpm: number;
  /** Mean pace across all snapshots with a finite pace; Infinity if none. */
  avgPaceSecondsPer500m: number;
  /** Mean heart rate across all snapshots that had a reading, or null if no HR data. */
  avgHeartRateBpm: number | null;
  /** Peak heart rate observed during the session, or null if no HR data. */
  maxHeartRateBpm: number | null;
  /**
   * Final HR-derived cumulative calorie estimate, in kcal. `null` when
   * no snapshot ever carried a `caloriesKcal` value (i.e. no HR was
   * ever reported), so consumers can distinguish "we have nothing to
   * say" from "the user burned 0 kcal".
   */
  totalCaloriesKcal: number | null;
};

/**
 * A single pause window inside a recording, expressed in wall-clock
 * seconds relative to {@link ActivitySummary.startedAtMs}. The FIT
 * writer uses these to emit `timer/stop` and `timer/start` events so
 * downstream viewers (Strava, Garmin Connect) report the pause boundary
 * correctly and exclude paused time from moving-time calculations.
 */
export type PauseInterval = {
  /** Wall-clock seconds since `startedAtMs` when the pause began. */
  startElapsedS: number;
  /** Wall-clock seconds since `startedAtMs` when the pause ended. */
  endElapsedS: number;
};

export type RecordedActivity = {
  /** Stable, sortable, locally-unique identifier (no UUID dependency). */
  id: string;
  summary: ActivitySummary;
  records: RecordSnapshot[];
  strokes: StrokeEvent[];
  /**
   * Closed pause windows captured during the session, in chronological
   * order. Empty when the user never paused. The recorder closes any
   * still-open pause inside `finish()`, so callers can assume every
   * interval has both endpoints.
   */
  pauses: PauseInterval[];
};

/** Inputs accepted by {@link ActivityRecorder.tick}. */
export type SnapshotInput = {
  cadenceSpm: number;
  paceSecondsPer500m: number;
  strokeCount: number;
  heartRateBpm: number | null;
  /**
   * Cumulative HR-derived calorie estimate at the moment of the tick,
   * in kcal. Optional: when omitted (or `null`) the recorder treats
   * it as "no calorie data" and `summary.totalCaloriesKcal` stays
   * `null` if no other tick supplies one. The caller is responsible
   * for the integration; the recorder just stores what it's handed.
   */
  caloriesKcal?: number | null;
};

export type ActivityRecorder = {
  /** Begin a new recording. Subsequent ticks/strokes anchor on this moment. */
  start(nowMs: number): void;
  /**
   * Record a 1 Hz metrics snapshot. Calls within {@link RECORD_INTERVAL_MS}
   * of the previous accepted snapshot are ignored, so the caller can drive
   * this from a tight render loop without inflating the record stream.
   *
   * No-op while the recorder is paused.
   */
  tick(input: SnapshotInput, nowMs: number): void;
  /**
   * Record a single stroke event at the given moment. No-op while the
   * recorder is paused — strokes detected during a pause window aren't
   * part of the user's recording.
   */
  markStroke(cadenceSpm: number, nowMs: number): void;
  /**
   * Open a pause window at `nowMs`. Subsequent `tick()` and
   * `markStroke()` calls are ignored until `resume()`. No-op when the
   * recorder isn't running or is already paused.
   */
  pause(nowMs: number): void;
  /**
   * Close the open pause window at `nowMs` and append it to the
   * activity's `pauses[]`. No-op when the recorder isn't paused.
   */
  resume(nowMs: number): void;
  /**
   * End the recording, compute summary metrics, and return the activity
   * payload. After finish() the recorder returns to an empty, stopped state
   * — call {@link start} again to begin a fresh session.
   *
   * If the recorder is currently paused, the open pause is closed at
   * `nowMs` so the resulting activity has a clean pause list.
   */
  finish(nowMs: number): RecordedActivity;
  readonly isRunning: boolean;
  /** True while the recorder is between `pause()` and `resume()`. */
  readonly isPaused: boolean;
  /** Snapshot count so far (mostly useful for tests/UI). */
  readonly recordCount: number;
};
