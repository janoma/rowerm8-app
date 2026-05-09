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
  /** Total duration of the session in seconds. */
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
};

export type RecordedActivity = {
  /** Stable, sortable, locally-unique identifier (no UUID dependency). */
  id: string;
  summary: ActivitySummary;
  records: RecordSnapshot[];
  strokes: StrokeEvent[];
};

/** Inputs accepted by {@link ActivityRecorder.tick}. */
export type SnapshotInput = {
  cadenceSpm: number;
  paceSecondsPer500m: number;
  strokeCount: number;
  heartRateBpm: number | null;
};

export type ActivityRecorder = {
  /** Begin a new recording. Subsequent ticks/strokes anchor on this moment. */
  start(nowMs: number): void;
  /**
   * Record a 1 Hz metrics snapshot. Calls within {@link RECORD_INTERVAL_MS}
   * of the previous accepted snapshot are ignored, so the caller can drive
   * this from a tight render loop without inflating the record stream.
   */
  tick(input: SnapshotInput, nowMs: number): void;
  /** Record a single stroke event at the given moment. */
  markStroke(cadenceSpm: number, nowMs: number): void;
  /**
   * End the recording, compute summary metrics, and return the activity
   * payload. After finish() the recorder returns to an empty, stopped state
   * — call {@link start} again to begin a fresh session.
   */
  finish(nowMs: number): RecordedActivity;
  readonly isRunning: boolean;
  /** Snapshot count so far (mostly useful for tests/UI). */
  readonly recordCount: number;
};
