/**
 * @jest-environment node
 */
import { encodeActivityToFit } from "@/lib/activity/fit-writer";
import { decodeFitToActivity, downsampleMean } from "@/lib/activity/fit-reader";
import type { RecordedActivity } from "@/lib/activity/types";

function buildFixture(): RecordedActivity {
  const startedAtMs = Date.UTC(2026, 4, 8, 14, 0, 0);
  const records = Array.from({ length: 120 }, (_, i) => ({
    elapsedS: i,
    cadenceSpm: 24 + (i % 4),
    paceSecondsPer500m: 120 + (i % 10),
    strokeCount: Math.floor((i * 24) / 60),
    heartRateBpm: i < 10 ? null : 120 + (i % 15),
    caloriesKcal: null,
  }));
  return {
    id: "test",
    summary: {
      startedAtMs,
      endedAtMs: startedAtMs + 120_000,
      durationS: 120,
      strokeCount: records[records.length - 1].strokeCount,
      avgCadenceSpm: 25.5,
      avgPaceSecondsPer500m: 124,
      avgHeartRateBpm: 127,
      maxHeartRateBpm: 134,
      totalCaloriesKcal: null,
    },
    records,
    strokes: [],
    pauses: [],
  };
}

describe("FIT reader", () => {
  it("round-trips an activity through the writer and reader", () => {
    const activity = buildFixture();
    const bytes = encodeActivityToFit(activity);
    const decoded = decodeFitToActivity(bytes);

    expect(decoded.records.length).toBe(120);
    expect(decoded.durationS).toBe(119);
    expect(decoded.startedAtMs).toBe(activity.summary.startedAtMs);
  });

  it("anchors elapsed time to the first record", () => {
    const decoded = decodeFitToActivity(encodeActivityToFit(buildFixture()));
    expect(decoded.records[0].elapsedS).toBe(0);
    expect(decoded.records[1].elapsedS).toBe(1);
    expect(decoded.records[decoded.records.length - 1].elapsedS).toBe(119);
  });

  it("preserves cadence and HR with the right semantics", () => {
    const decoded = decodeFitToActivity(encodeActivityToFit(buildFixture()));
    // Cadence 24 + (i%4): every record should have cadence
    expect(decoded.records[0].cadenceSpm).toBe(24);
    expect(decoded.records[1].cadenceSpm).toBe(25);

    // First 10 had no HR -> should round-trip as null
    expect(decoded.records[0].heartRateBpm).toBeNull();
    expect(decoded.records[5].heartRateBpm).toBeNull();
    // Index 10 onward should have HR
    expect(decoded.records[10].heartRateBpm).toBeGreaterThan(0);
    expect(decoded.records[20].heartRateBpm).toBeGreaterThan(0);
  });

  it("returns speed in m/s when pace was recorded", () => {
    const decoded = decodeFitToActivity(encodeActivityToFit(buildFixture()));
    // 500 / paceSecondsPer500m: at i=0, pace=120 -> ~4.17 m/s
    expect(decoded.records[0].speedMps).toBeGreaterThan(0);
    expect(decoded.records[0].speedMps).toBeLessThan(10);
  });

  it("gracefully handles an empty record stream", () => {
    const empty: RecordedActivity = {
      id: "empty",
      summary: {
        startedAtMs: Date.UTC(2026, 4, 8, 14, 0, 0),
        endedAtMs: Date.UTC(2026, 4, 8, 14, 0, 1),
        durationS: 1,
        strokeCount: 0,
        avgCadenceSpm: 0,
        avgPaceSecondsPer500m: Number.POSITIVE_INFINITY,
        avgHeartRateBpm: null,
        maxHeartRateBpm: null,
        totalCaloriesKcal: null,
      },
      records: [],
      strokes: [],
      pauses: [],
    };
    const decoded = decodeFitToActivity(encodeActivityToFit(empty));
    expect(decoded.records).toEqual([]);
    expect(decoded.durationS).toBe(0);
  });

  it("rejects non-FIT bytes", () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    expect(() => decodeFitToActivity(garbage)).toThrow();
  });
});

describe("downsampleMean", () => {
  it("returns input unchanged when shorter than maxBuckets", () => {
    expect(downsampleMean([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it("buckets into maxBuckets even-sized groups by mean", () => {
    const values = [1, 1, 1, 1, 5, 5, 5, 5];
    expect(downsampleMean(values, 2)).toEqual([1, 5]);
  });

  it("ignores nulls inside a bucket", () => {
    const values = [null, 10, null, 20];
    expect(downsampleMean(values, 2)).toEqual([10, 20]);
  });

  it("emits null for buckets that are entirely null", () => {
    const values = [null, null, 4, 4];
    expect(downsampleMean(values, 2)).toEqual([null, 4]);
  });

  it("handles maxBuckets=0 safely", () => {
    expect(downsampleMean([1, 2, 3], 0)).toEqual([]);
  });
});
