/**
 * Encode a `RecordedActivity` as a FIT v2 file accepted by Strava, Garmin
 * Connect, TrainingPeaks, and friends.
 *
 * The structure follows Garmin's "Encode Activity" recipe (FILE_ID →
 * DEVICE_INFO → timer-start EVENT → RECORDs → timer-stop EVENT → LAP →
 * SESSION → ACTIVITY) with `sport=rowing` / `subSport=indoorRowing`.
 *
 * Pure: no I/O. The caller writes the returned bytes to disk via
 * `expo-file-system` (or anywhere else, e.g. tests).
 */
import { Encoder, Profile } from "@garmin/fitsdk";

import type { RecordedActivity } from "./types";

/**
 * Identifier reported in the FIT FILE_ID message. "development" is a
 * reserved Garmin manufacturer for non-Garmin software; valid for activity
 * files uploaded to Strava/TP. We bump `productName` instead of carrying a
 * fake numeric product id.
 */
const FIT_MANUFACTURER = "development";
const FIT_PRODUCT = 0;
const FIT_PRODUCT_NAME = "RowerM8";

/**
 * Convert a JS Date (or ms epoch) to FIT-epoch seconds (1989-12-31 UTC).
 * The Garmin Utils helper does the same; we inline the constant here so
 * we don't depend on the helper's runtime export name.
 */
const FIT_EPOCH_MS = 631_065_600_000;
function toFitDateTime(ms: number): number {
  return Math.floor((ms - FIT_EPOCH_MS) / 1000);
}

/** Convert m/s into FIT speed units (mm/s, uint16 in the on-disk profile). */
function speedMps(paceSecondsPer500m: number): number {
  if (!Number.isFinite(paceSecondsPer500m) || paceSecondsPer500m <= 0) {
    return 0;
  }
  return 500 / paceSecondsPer500m;
}

/**
 * Encode the activity to FIT bytes. The caller is responsible for writing
 * the result; nothing here touches the file system.
 */
export function encodeActivityToFit(activity: RecordedActivity): Uint8Array {
  const encoder = new Encoder();

  const startFit = toFitDateTime(activity.summary.startedAtMs);
  const endFit = toFitDateTime(activity.summary.endedAtMs);
  const totalElapsedTime = activity.summary.durationS;
  const totalTimerTime = activity.summary.durationS;

  // Every FIT file MUST start with a FILE_ID message.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "activity",
    manufacturer: FIT_MANUFACTURER,
    product: FIT_PRODUCT,
    timeCreated: new Date(activity.summary.startedAtMs),
    serialNumber: 1,
  });

  // BEST PRACTICE: identify the recorder.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.DEVICE_INFO,
    deviceIndex: "creator",
    manufacturer: FIT_MANUFACTURER,
    product: FIT_PRODUCT,
    productName: FIT_PRODUCT_NAME,
    serialNumber: 1,
    timestamp: startFit,
  });

  // Timer start.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.EVENT,
    timestamp: startFit,
    event: "timer",
    eventType: "start",
  });

  // 1 Hz record stream. Each snapshot becomes one RECORD message; we don't
  // synthesize records when there are none (e.g. the user paused with no
  // sample yet) — Strava is happy with sparse files as long as the
  // session/activity wrappers are intact.
  for (const r of activity.records) {
    const ts = startFit + Math.round(r.elapsedS);
    const speed = speedMps(r.paceSecondsPer500m);
    const mesg: Record<string, unknown> = {
      mesgNum: Profile.MesgNum.RECORD,
      timestamp: ts,
      // FIT cadence is uint8 strokes/min — round to fit the encoding.
      cadence: r.cadenceSpm > 0 ? Math.round(r.cadenceSpm) : 0,
      // Speed is encoded by the SDK in m/s; pace<=0 means we don't know yet.
      enhancedSpeed: speed,
      speed,
    };
    if (r.heartRateBpm != null) {
      mesg.heartRate = Math.round(r.heartRateBpm);
    }
    encoder.writeMesg(mesg);
  }

  // Per-stroke event markers. Some viewers (Strava in particular) ignore
  // these but they're useful for downstream tooling and round-trip testing.
  for (const s of activity.strokes) {
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.EVENT,
      timestamp: startFit + Math.round(s.elapsedS),
      event: "rearGearChange", // No "stroke" event in stock FIT; reuse a marker
      eventType: "marker",
    });
  }

  // Timer stop.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.EVENT,
    timestamp: endFit,
    event: "timer",
    eventType: "stopAll",
  });

  // Every FIT activity MUST contain at least one LAP. We emit a single lap
  // covering the whole session.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.LAP,
    messageIndex: 0,
    timestamp: endFit,
    startTime: startFit,
    totalElapsedTime,
    totalTimerTime,
    totalStrokes: activity.summary.strokeCount,
    sport: "rowing",
    subSport: "indoorRowing",
    avgCadence:
      activity.summary.avgCadenceSpm > 0
        ? Math.round(activity.summary.avgCadenceSpm)
        : undefined,
    avgHeartRate:
      activity.summary.avgHeartRateBpm != null
        ? Math.round(activity.summary.avgHeartRateBpm)
        : undefined,
    maxHeartRate:
      activity.summary.maxHeartRateBpm != null
        ? Math.round(activity.summary.maxHeartRateBpm)
        : undefined,
  });

  // Every FIT activity MUST contain at least one SESSION.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.SESSION,
    messageIndex: 0,
    timestamp: endFit,
    startTime: startFit,
    totalElapsedTime,
    totalTimerTime,
    totalStrokes: activity.summary.strokeCount,
    sport: "rowing",
    subSport: "indoorRowing",
    firstLapIndex: 0,
    numLaps: 1,
    avgCadence:
      activity.summary.avgCadenceSpm > 0
        ? Math.round(activity.summary.avgCadenceSpm)
        : undefined,
    avgHeartRate:
      activity.summary.avgHeartRateBpm != null
        ? Math.round(activity.summary.avgHeartRateBpm)
        : undefined,
    maxHeartRate:
      activity.summary.maxHeartRateBpm != null
        ? Math.round(activity.summary.maxHeartRateBpm)
        : undefined,
  });

  // Every FIT activity MUST contain EXACTLY one ACTIVITY message.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.ACTIVITY,
    timestamp: endFit,
    numSessions: 1,
    totalTimerTime,
  });

  return encoder.close();
}
