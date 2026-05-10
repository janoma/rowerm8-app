/**
 * Pure activity recorder. Accepts 1 Hz metric snapshots and per-stroke
 * events, then produces a `RecordedActivity` summary on finish().
 *
 * No React, no I/O, no platform clocks. The caller is responsible for
 * supplying timestamps so tests stay deterministic and the UI can use the
 * same `Date.now()` it uses for sample arrival.
 */

import type {
  ActivityRecorder,
  PauseInterval,
  RecordedActivity,
  RecordSnapshot,
  SnapshotInput,
  StrokeEvent,
} from "./types";

/**
 * Minimum wall-clock spacing between accepted snapshots. The Free Row
 * screen drives `tick()` from a 60 Hz render loop; this throttle keeps the
 * record stream at the ~1 Hz cadence the FIT format expects.
 */
export const RECORD_INTERVAL_MS = 1000;

function makeId(startMs: number): string {
  // Stable, sortable, no external uuid dependency. The random suffix only
  // exists to disambiguate two activities started in the same millisecond
  // (extremely unlikely, but cheap to defend against).
  return `${startMs}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function meanFinite(values: number[]): number {
  // We deliberately drop non-finite/sentinel values (Infinity for pace
  // before the first stroke) before averaging so a long warmup doesn't
  // poison the summary with garbage data.
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function meanFinitePositive(values: number[]): number {
  // Used for cadence: pre-stroke values are 0 (the seed), which we don't
  // want to drag the average down toward.
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v) && v > 0) {
      sum += v;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

export function createActivityRecorder(): ActivityRecorder {
  let startedAtMs: number | null = null;
  let lastTickMs: number | null = null;
  let pauseStartedAtMs: number | null = null;
  let pausedMs = 0;
  const records: RecordSnapshot[] = [];
  const strokes: StrokeEvent[] = [];
  const pauses: PauseInterval[] = [];

  function reset(): void {
    startedAtMs = null;
    lastTickMs = null;
    pauseStartedAtMs = null;
    pausedMs = 0;
    records.length = 0;
    strokes.length = 0;
    pauses.length = 0;
  }

  function start(nowMs: number): void {
    reset();
    startedAtMs = nowMs;
  }

  function tick(input: SnapshotInput, nowMs: number): void {
    if (startedAtMs == null) {
      return;
    }
    if (pauseStartedAtMs != null) {
      return;
    }
    if (lastTickMs != null && nowMs - lastTickMs < RECORD_INTERVAL_MS) {
      return;
    }
    lastTickMs = nowMs;
    const elapsedS = Math.max(0, (nowMs - startedAtMs) / 1000);
    records.push({
      elapsedS,
      cadenceSpm: input.cadenceSpm,
      paceSecondsPer500m: input.paceSecondsPer500m,
      strokeCount: input.strokeCount,
      heartRateBpm: input.heartRateBpm,
    });
  }

  function markStroke(cadenceSpm: number, nowMs: number): void {
    if (startedAtMs == null) {
      return;
    }
    if (pauseStartedAtMs != null) {
      return;
    }
    const elapsedS = Math.max(0, (nowMs - startedAtMs) / 1000);
    strokes.push({ elapsedS, cadenceSpm });
  }

  function pause(nowMs: number): void {
    if (startedAtMs == null || pauseStartedAtMs != null) {
      return;
    }
    pauseStartedAtMs = nowMs;
  }

  function resume(nowMs: number): void {
    if (startedAtMs == null || pauseStartedAtMs == null) {
      return;
    }
    const start_ = startedAtMs;
    const pauseStart = pauseStartedAtMs;
    const startElapsedS = Math.max(0, (pauseStart - start_) / 1000);
    const endElapsedS = Math.max(startElapsedS, (nowMs - start_) / 1000);
    pauses.push({ startElapsedS, endElapsedS });
    pausedMs += Math.max(0, nowMs - pauseStart);
    pauseStartedAtMs = null;
    // Reset the tick throttle so the first post-resume tick lands
    // immediately. Otherwise a paused window slightly shorter than
    // RECORD_INTERVAL_MS could swallow the next snapshot, leaving a
    // visible gap in the record stream.
    lastTickMs = null;
  }

  function finish(nowMs: number): RecordedActivity {
    if (startedAtMs == null) {
      throw new Error("ActivityRecorder.finish called before start");
    }
    // Closing the open pause (if any) keeps the returned `pauses[]`
    // self-consistent: every interval has both endpoints, so the FIT
    // writer can emit matched timer/stop + timer/start pairs.
    if (pauseStartedAtMs != null) {
      resume(nowMs);
    }
    const start_ = startedAtMs;
    const durationS = Math.max(0, (nowMs - start_ - pausedMs) / 1000);

    const lastSnapshotStrokeCount =
      records.length > 0 ? records[records.length - 1].strokeCount : 0;

    // We trust whichever count is larger: the snapshot stream usually
    // mirrors the live counter, but the explicit markStroke events are the
    // ground truth for events emitted between snapshots.
    const strokeCount = Math.max(lastSnapshotStrokeCount, strokes.length);

    const heartRates = records
      .map((r) => r.heartRateBpm)
      .filter((v): v is number => v != null);

    const summary = {
      startedAtMs: start_,
      endedAtMs: nowMs,
      durationS,
      strokeCount,
      avgCadenceSpm: meanFinitePositive(records.map((r) => r.cadenceSpm)),
      avgPaceSecondsPer500m: records.length
        ? meanFinite(records.map((r) => r.paceSecondsPer500m))
        : Number.POSITIVE_INFINITY,
      avgHeartRateBpm: heartRates.length
        ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length
        : null,
      maxHeartRateBpm: heartRates.length ? Math.max(...heartRates) : null,
    };

    const id = makeId(start_);
    const result: RecordedActivity = {
      id,
      summary,
      records: [...records],
      strokes: [...strokes],
      pauses: [...pauses],
    };
    reset();
    return result;
  }

  return {
    start,
    tick,
    markStroke,
    pause,
    resume,
    finish,
    get isRunning() {
      return startedAtMs != null;
    },
    get isPaused() {
      return pauseStartedAtMs != null;
    },
    get recordCount() {
      return records.length;
    },
  };
}
