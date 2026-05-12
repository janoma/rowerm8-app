/**
 * Pure activity recorder. Accepts 1 Hz metric snapshots and per-stroke
 * events, then produces a `RecordedActivity` summary on finish().
 *
 * No React, no I/O, no platform clocks. The caller is responsible for
 * supplying timestamps so tests stay deterministic and the UI can use the
 * same `Date.now()` it uses for sample arrival.
 */

import type {
  ActivityDraft,
  ActivityEndedReason,
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

/**
 * Idle thresholds used by the no-notification "forgot to stop" fallback.
 *
 * If no stroke is detected for {@link INACTIVITY_AUTO_PAUSE_MS} while the
 * recorder is running, the UI auto-pauses. If the recorder then sits
 * paused for {@link INACTIVITY_AUTO_SAVE_MS} without a manual resume, the
 * UI auto-saves the activity (truncated to the last detected stroke) and
 * marks `summary.endedReason = "inactivity-timeout"`.
 *
 * These constants live next to the recorder so unit tests can import
 * them and the UI can re-use them for any banners/notifications.
 */
export const INACTIVITY_AUTO_PAUSE_MS = 3 * 60_000;
export const INACTIVITY_AUTO_SAVE_MS = 30 * 60_000;

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
  let id: string | null = null;
  let startedAtMs: number | null = null;
  let lastTickMs: number | null = null;
  let lastEventAtMs: number | null = null;
  let lastStrokeAtMs: number | null = null;
  let pauseStartedAtMs: number | null = null;
  let pausedMs = 0;
  let dirty = false;
  const records: RecordSnapshot[] = [];
  const strokes: StrokeEvent[] = [];
  const pauses: PauseInterval[] = [];

  function reset(): void {
    id = null;
    startedAtMs = null;
    lastTickMs = null;
    lastEventAtMs = null;
    lastStrokeAtMs = null;
    pauseStartedAtMs = null;
    pausedMs = 0;
    dirty = false;
    records.length = 0;
    strokes.length = 0;
    pauses.length = 0;
  }

  function start(nowMs: number): void {
    reset();
    id = makeId(nowMs);
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
    const caloriesIn =
      input.caloriesKcal != null && Number.isFinite(input.caloriesKcal)
        ? Math.max(0, input.caloriesKcal)
        : null;
    records.push({
      elapsedS,
      cadenceSpm: input.cadenceSpm,
      paceSecondsPer500m: input.paceSecondsPer500m,
      strokeCount: input.strokeCount,
      heartRateBpm: input.heartRateBpm,
      caloriesKcal: caloriesIn,
    });
    lastEventAtMs = nowMs;
    dirty = true;
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
    lastStrokeAtMs = nowMs;
    lastEventAtMs = nowMs;
    dirty = true;
  }

  function pause(nowMs: number): void {
    if (startedAtMs == null || pauseStartedAtMs != null) {
      return;
    }
    pauseStartedAtMs = nowMs;
    dirty = true;
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
    dirty = true;
  }

  function truncateTo(lastValidAtMs: number): void {
    if (startedAtMs == null) {
      return;
    }
    const start_ = startedAtMs;
    if (lastValidAtMs <= start_) {
      records.length = 0;
      strokes.length = 0;
      pauses.length = 0;
      pauseStartedAtMs = null;
      pausedMs = 0;
      lastTickMs = null;
      lastEventAtMs = null;
      lastStrokeAtMs = null;
      dirty = true;
      return;
    }
    const cutoffElapsedS = Math.max(0, (lastValidAtMs - start_) / 1000);

    while (
      records.length > 0 &&
      records[records.length - 1].elapsedS > cutoffElapsedS
    ) {
      records.pop();
    }
    while (
      strokes.length > 0 &&
      strokes[strokes.length - 1].elapsedS > cutoffElapsedS
    ) {
      strokes.pop();
    }
    while (
      pauses.length > 0 &&
      pauses[pauses.length - 1].startElapsedS >= cutoffElapsedS
    ) {
      const dropped = pauses.pop();
      if (dropped) {
        // Roll the dropped pause window back out of the cumulative
        // paused-time accumulator so the surviving moving-time math
        // stays consistent.
        const spanS = Math.max(0, dropped.endElapsedS - dropped.startElapsedS);
        pausedMs = Math.max(0, pausedMs - spanS * 1000);
      }
    }
    if (pauses.length > 0) {
      // The latest surviving pause may still extend past the cutoff;
      // clamp its end so the moving-time math doesn't include time
      // beyond the truncation point.
      const last = pauses[pauses.length - 1];
      if (last.endElapsedS > cutoffElapsedS) {
        const removedS = last.endElapsedS - cutoffElapsedS;
        last.endElapsedS = cutoffElapsedS;
        pausedMs = Math.max(0, pausedMs - removedS * 1000);
      }
    }

    if (pauseStartedAtMs != null && pauseStartedAtMs >= lastValidAtMs) {
      pauseStartedAtMs = null;
    }
    lastTickMs = null;
    lastStrokeAtMs =
      strokes.length > 0
        ? start_ + strokes[strokes.length - 1].elapsedS * 1000
        : null;
    lastEventAtMs =
      records.length > 0
        ? Math.max(
            start_ + records[records.length - 1].elapsedS * 1000,
            lastStrokeAtMs ?? 0,
          )
        : lastStrokeAtMs;
    dirty = true;
  }

  function finish(
    nowMs: number,
    endedReason: ActivityEndedReason = "user",
  ): RecordedActivity {
    if (startedAtMs == null || id == null) {
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

    // The recorder's caloriesKcal is monotonic: the last non-null
    // value is the final total. If we never saw a value we keep this
    // null so consumers can tell "HR-less recording" from
    // "HR-connected, burned 0 kcal".
    let totalCaloriesKcal: number | null = null;
    for (let i = records.length - 1; i >= 0; i -= 1) {
      const v = records[i].caloriesKcal;
      if (v != null) {
        totalCaloriesKcal = v;
        break;
      }
    }

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
      totalCaloriesKcal,
      endedReason,
    };

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

  function abandon(): void {
    reset();
  }

  function serialize(opts: {
    motionSource: "phone" | "ble";
    uiPhase: "running" | "paused";
    nowMs: number;
  }): ActivityDraft | null {
    if (startedAtMs == null || id == null) {
      return null;
    }
    return {
      schemaVersion: 1,
      id,
      startedAtMs,
      lastEventAtMs: lastEventAtMs ?? startedAtMs,
      lastStrokeAtMs,
      pausedMs,
      pauseStartedAtMs,
      pauses: pauses.map((p) => ({ ...p })),
      records: records.map((r) => ({ ...r })),
      strokes: strokes.map((s) => ({ ...s })),
      motionSource: opts.motionSource,
      uiPhase: opts.uiPhase,
    };
  }

  function restoreFrom(draft: ActivityDraft): void {
    reset();
    id = draft.id;
    startedAtMs = draft.startedAtMs;
    lastEventAtMs = draft.lastEventAtMs;
    lastStrokeAtMs = draft.lastStrokeAtMs;
    pausedMs = draft.pausedMs;
    pauseStartedAtMs = draft.pauseStartedAtMs;
    for (const p of draft.pauses) {
      pauses.push({ ...p });
    }
    for (const r of draft.records) {
      records.push({ ...r });
    }
    for (const s of draft.strokes) {
      strokes.push({ ...s });
    }
    // The draft was written from a clean state, so we don't owe an
    // immediate re-flush. Subsequent ticks/strokes will mark dirty
    // again. We also reset the throttle anchor so the first post-
    // restore tick lands without waiting for the next 1 s window.
    lastTickMs = null;
    dirty = false;
  }

  return {
    start,
    tick,
    markStroke,
    pause,
    resume,
    finish,
    abandon,
    truncateTo,
    serialize,
    restoreFrom,
    clearDirty() {
      dirty = false;
    },
    get isDirty() {
      return dirty;
    },
    get currentId() {
      return id;
    },
    get isRunning() {
      return startedAtMs != null;
    },
    get isPaused() {
      return pauseStartedAtMs != null;
    },
    get recordCount() {
      return records.length;
    },
    get lastEventAtMs() {
      return lastEventAtMs;
    },
    get lastStrokeAtMs() {
      return lastStrokeAtMs;
    },
  };
}
