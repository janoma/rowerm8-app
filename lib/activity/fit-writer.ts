/**
 * Encode a `RecordedActivity` as a FIT v2 file accepted by Strava, Garmin
 * Connect, TrainingPeaks, and friends.
 *
 * The structure follows Garmin's "Encode Activity" recipe (FILE_ID →
 * DEVICE_INFO → developer-data metadata → timer-start EVENT → RECORDs →
 * timer-stop EVENT → LAP → SESSION → ACTIVITY) with `sport=rowing` /
 * `subSport=indoorRowing`.
 *
 * We don't have a real distance sensor — pace is estimated from cadence — so
 * the writer also integrates per-record speed into a cumulative `distance`
 * (set on every RECORD) and emits the final `totalDistance` on LAP and
 * SESSION. Without this, Strava silently drops indoor-rowing pace/distance
 * even when `speed` is present.
 *
 * A developer field on the SESSION carries the human-readable disclosure
 * `"Speed and pace estimated by RowerM8."` and the device product name is
 * bumped to `"RowerM8 (est. pace)"` so the disclosure surfaces in FIT
 * viewers that don't render developer data.
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
 * fake numeric product id, and include "(est. pace)" so viewers that
 * surface device details know the speed/pace stream is estimated.
 */
const FIT_MANUFACTURER = "development";
const FIT_PRODUCT = 0;
const FIT_PRODUCT_NAME = "RowerM8 (est. pace)";

/**
 * Free-form disclosure attached to the SESSION via FIT developer data.
 * Strava ignores developer fields, but Garmin Connect and most FIT viewers
 * surface them, so this is the most "official" place to document that the
 * file's speed and pace are estimated rather than measured.
 */
const ESTIMATION_NOTE = "Speed and pace estimated by RowerM8.";

/**
 * Identifiers for the developer-data field carrying the estimation
 * disclosure. The application id is a stable 16-byte tag the spec requires
 * (`RowerM8\0...` padded out to 16 bytes); the developer data index and
 * field-definition number are arbitrary as long as they're unique within
 * the file.
 */
const DEVELOPER_DATA_INDEX = 0;
const ESTIMATION_NOTE_FIELD_KEY = "estimation_note";
const ESTIMATION_NOTE_FIELD_DEF_NUM = 0;
/** FIT base type id for `string` (see `BaseType.STRING` in the SDK). */
const FIT_BASE_TYPE_STRING = 0x07;
const ROWERM8_APPLICATION_ID = [
  0x52, 0x6f, 0x77, 0x65, 0x72, 0x4d, 0x38, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x01,
] as const;

/**
 * Convert a JS Date (or ms epoch) to FIT-epoch seconds (1989-12-31 UTC).
 * The Garmin Utils helper does the same; we inline the constant here so
 * we don't depend on the helper's runtime export name.
 */
const FIT_EPOCH_MS = 631_065_600_000;
function toFitDateTime(ms: number): number {
  return Math.floor((ms - FIT_EPOCH_MS) / 1000);
}

/** Convert 500 m split pace into m/s. Pace ≤ 0 means "not yet known". */
function speedMps(paceSecondsPer500m: number): number {
  if (!Number.isFinite(paceSecondsPer500m) || paceSecondsPer500m <= 0) {
    return 0;
  }
  return 500 / paceSecondsPer500m;
}

/**
 * Pre-built developer-data metadata for the estimation-note field. Passed
 * to the Encoder constructor so it can wire up message definitions; we
 * also `writeMesg` both records into the file so decoders can resolve the
 * field on the SESSION.
 */
function buildEstimationFieldDescription() {
  const developerDataIdMesg = {
    mesgNum: Profile.MesgNum.DEVELOPER_DATA_ID,
    applicationId: ROWERM8_APPLICATION_ID as unknown as number[],
    developerDataIndex: DEVELOPER_DATA_INDEX,
  };
  const fieldDescriptionMesg = {
    mesgNum: Profile.MesgNum.FIELD_DESCRIPTION,
    developerDataIndex: DEVELOPER_DATA_INDEX,
    fieldDefinitionNumber: ESTIMATION_NOTE_FIELD_DEF_NUM,
    fitBaseTypeId: FIT_BASE_TYPE_STRING,
    fieldName: ESTIMATION_NOTE_FIELD_KEY,
  };
  return { developerDataIdMesg, fieldDescriptionMesg };
}

/**
 * Encode the activity to FIT bytes. The caller is responsible for writing
 * the result; nothing here touches the file system.
 */
export function encodeActivityToFit(activity: RecordedActivity): Uint8Array {
  const { developerDataIdMesg, fieldDescriptionMesg } =
    buildEstimationFieldDescription();

  const encoder = new Encoder({
    fieldDescriptions: {
      [ESTIMATION_NOTE_FIELD_KEY]: {
        developerDataIdMesg,
        fieldDescriptionMesg,
      },
    },
  });

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

  // Register our developer field BEFORE the SESSION (or any other message)
  // that uses it. Per the FIT spec the DEVELOPER_DATA_ID must precede the
  // FIELD_DESCRIPTION, which must precede any consumer message.
  encoder.writeMesg(developerDataIdMesg);
  encoder.writeMesg(fieldDescriptionMesg);

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
  //
  // We don't carry distance from the sensor (there is none), so we
  // integrate `(prevSpeed + currSpeed) / 2 * dt` across consecutive
  // records to produce a monotonic cumulative `distance`. Without this,
  // Strava drops indoor-rowing pace/distance even though `speed` is set.
  let prevSpeed = 0;
  let prevElapsedS = 0;
  let cumulativeDistanceM = 0;
  for (const r of activity.records) {
    const ts = startFit + Math.round(r.elapsedS);
    const speed = speedMps(r.paceSecondsPer500m);
    const dt = Math.max(0, r.elapsedS - prevElapsedS);
    cumulativeDistanceM += ((prevSpeed + speed) / 2) * dt;
    prevSpeed = speed;
    prevElapsedS = r.elapsedS;

    const mesg: Record<string, unknown> = {
      mesgNum: Profile.MesgNum.RECORD,
      timestamp: ts,
      // FIT cadence is uint8 strokes/min — round to fit the encoding.
      cadence: r.cadenceSpm > 0 ? Math.round(r.cadenceSpm) : 0,
      // Speed is encoded by the SDK in m/s; pace<=0 means we don't know yet.
      enhancedSpeed: speed,
      speed,
      // Distance is encoded by the SDK in meters (scale 100 internally).
      distance: cumulativeDistanceM,
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
    totalDistance: cumulativeDistanceM,
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

  // Every FIT activity MUST contain at least one SESSION. We attach the
  // estimation-disclosure developer field here so it survives round-trips
  // through Garmin Connect & friends.
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.SESSION,
    messageIndex: 0,
    timestamp: endFit,
    startTime: startFit,
    totalElapsedTime,
    totalTimerTime,
    totalStrokes: activity.summary.strokeCount,
    totalDistance: cumulativeDistanceM,
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
    developerFields: {
      [ESTIMATION_NOTE_FIELD_KEY]: ESTIMATION_NOTE,
    },
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

/**
 * Exposed for tests / callers that want to surface the same disclosure in
 * the UI (e.g. so the user can paste it into a Strava activity description).
 */
export const SPEED_ESTIMATION_DISCLOSURE = ESTIMATION_NOTE;
