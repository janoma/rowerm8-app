/**
 * FIT decoder: parse a FIT file's RECORD stream back into a structured,
 * UI-friendly shape. Used by the activity detail screen to draw cadence /
 * HR sparklines from the saved bytes.
 *
 * Pure: takes raw bytes, returns plain JS data. The caller does the I/O
 * (e.g. expo-file-system) and any caching.
 */
import { Decoder, Stream } from "@garmin/fitsdk";

export type DecodedActivityRecord = {
  /** Seconds since the first record's timestamp. */
  elapsedS: number;
  /** Strokes per minute, or null if absent / zero. */
  cadenceSpm: number | null;
  /** Heart rate in bpm, or null if no HR was recorded for this sample. */
  heartRateBpm: number | null;
  /** Speed in m/s, or null if pace was not yet known. */
  speedMps: number | null;
};

export type DecodedActivity = {
  /** Wall-clock start in epoch ms (derived from the first record's FIT timestamp). */
  startedAtMs: number;
  /** Duration spanned by the record stream, in seconds. */
  durationS: number;
  /** Per-sample stream, in source order. */
  records: DecodedActivityRecord[];
};

/** Milliseconds between the Unix epoch and the FIT epoch (1989-12-31 UTC). */
const FIT_EPOCH_MS = 631_065_600_000;

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * Decode FIT bytes into a structured activity payload.
 *
 * The decoder is configured to leave timestamps as raw FIT seconds (rather
 * than convert them to JS `Date`s); we re-anchor everything against the
 * first record so the output is independent of the absolute clock and
 * cheap to plot.
 *
 * Throws if the bytes aren't a valid FIT file or fail the integrity CRC.
 */
export function decodeFitToActivity(bytes: Uint8Array): DecodedActivity {
  const stream = Stream.fromByteArray(bytes);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT()) {
    throw new Error("Not a FIT file");
  }
  if (!decoder.checkIntegrity()) {
    throw new Error("FIT integrity check failed");
  }
  const { messages } = decoder.read({
    // Keep timestamps as raw FIT seconds; we anchor to the first record
    // ourselves so the chart is cheap to draw and timezone-independent.
    convertDateTimesToDates: false,
  });

  const records =
    ((messages as Record<string, unknown>).recordMesgs as
      | Record<string, unknown>[]
      | undefined) ?? [];
  if (records.length === 0) {
    return { startedAtMs: 0, durationS: 0, records: [] };
  }

  const firstTs = asNumber(records[0].timestamp) ?? 0;
  const lastTs = asNumber(records[records.length - 1].timestamp) ?? firstTs;
  const startedAtMs = firstTs * 1000 + FIT_EPOCH_MS;
  const durationS = Math.max(0, lastTs - firstTs);

  const out: DecodedActivityRecord[] = records.map((r) => {
    const ts = asNumber(r.timestamp) ?? firstTs;
    const elapsedS = Math.max(0, ts - firstTs);
    const cadence = asNumber(r.cadence);
    const hr = asNumber(r.heartRate);
    // FIT 21+ prefers `enhancedSpeed` (uint32) over the legacy `speed`
    // (uint16); decoders return both when present, so we prefer the
    // higher-precision field when it exists.
    const speed = asNumber(r.enhancedSpeed) ?? asNumber(r.speed);
    return {
      elapsedS,
      cadenceSpm: cadence != null && cadence > 0 ? cadence : null,
      heartRateBpm: hr != null && hr > 0 ? hr : null,
      speedMps: speed != null && speed > 0 ? speed : null,
    };
  });

  return { startedAtMs, durationS, records: out };
}

/**
 * Bucket-mean downsampling. Used by the chart layer to fit a long record
 * stream into a fixed pixel width without rendering thousands of `View`s.
 *
 * If `values` is shorter than `maxBuckets`, returns it unchanged. Otherwise
 * splits the stream into `maxBuckets` evenly-sized buckets and emits the
 * mean of the non-null entries in each. Buckets that contain only nulls
 * map to `null` so the renderer can leave that column empty.
 */
export function downsampleMean(
  values: (number | null)[],
  maxBuckets: number,
): (number | null)[] {
  if (maxBuckets <= 0) {
    return [];
  }
  if (values.length <= maxBuckets) {
    return values.slice();
  }
  const out: (number | null)[] = new Array(maxBuckets);
  for (let bucket = 0; bucket < maxBuckets; bucket++) {
    const start = Math.floor((bucket * values.length) / maxBuckets);
    const end = Math.floor(((bucket + 1) * values.length) / maxBuckets);
    let sum = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      const v = values[i];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    out[bucket] = count > 0 ? sum / count : null;
  }
  return out;
}
