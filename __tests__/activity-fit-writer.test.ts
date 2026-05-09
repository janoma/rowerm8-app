/**
 * @jest-environment node
 */
import { Decoder, Stream } from "@garmin/fitsdk";

import { encodeActivityToFit } from "@/lib/activity/fit-writer";
import type { RecordedActivity } from "@/lib/activity/types";

function fixtureActivity(): RecordedActivity {
  const startedAtMs = Date.UTC(2026, 4, 8, 14, 0, 0);
  const durationS = 600;
  const records = Array.from({ length: 600 }, (_, i) => ({
    elapsedS: i,
    cadenceSpm: 24 + (i % 5),
    paceSecondsPer500m: 120 + (i % 30),
    strokeCount: Math.floor((i * 24) / 60),
    heartRateBpm: i < 30 ? null : 120 + (i % 20),
  }));
  return {
    id: "test-activity",
    summary: {
      startedAtMs,
      endedAtMs: startedAtMs + durationS * 1000,
      durationS,
      strokeCount: records[records.length - 1].strokeCount,
      avgCadenceSpm: 26,
      avgPaceSecondsPer500m: 130,
      avgHeartRateBpm: 130,
      maxHeartRateBpm: 139,
    },
    records,
    strokes: Array.from({ length: 240 }, (_, i) => ({
      elapsedS: i * 2.5,
      cadenceSpm: 24,
    })),
  };
}

describe("FIT writer", () => {
  it("produces bytes that the official Garmin decoder accepts", () => {
    const bytes = encodeActivityToFit(fixtureActivity());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);

    const stream = Stream.fromByteArray(bytes);
    expect(Decoder.isFIT(stream)).toBe(true);
    const decoder = new Decoder(stream);
    expect(decoder.isFIT()).toBe(true);
    expect(decoder.checkIntegrity()).toBe(true);

    const { messages, errors } = decoder.read();
    expect(errors).toEqual([]);
    expect(messages.fileIdMesgs?.length).toBe(1);
    expect(messages.sessionMesgs?.length).toBe(1);
    expect(messages.activityMesgs?.length).toBe(1);
    expect(messages.lapMesgs?.length).toBe(1);
    expect(messages.recordMesgs?.length).toBe(600);
  });

  it("marks the session as indoor rowing", () => {
    const bytes = encodeActivityToFit(fixtureActivity());
    const stream = Stream.fromByteArray(bytes);
    const decoder = new Decoder(stream);
    const { messages } = decoder.read();
    const session = messages.sessionMesgs?.[0] as Record<string, unknown>;
    expect(session.sport).toBe("rowing");
    expect(session.subSport).toBe("indoorRowing");
    expect(session.totalTimerTime).toBeCloseTo(600, 0);
  });

  it("emits heartRate on records that had a reading and omits it otherwise", () => {
    const bytes = encodeActivityToFit(fixtureActivity());
    const stream = Stream.fromByteArray(bytes);
    const decoder = new Decoder(stream);
    const { messages } = decoder.read();
    const records = (messages.recordMesgs ?? []) as Record<string, unknown>[];
    expect(records[0].heartRate).toBeUndefined();
    expect(records[100].heartRate).toBeGreaterThan(0);
  });

  it("handles empty record streams without throwing", () => {
    const startedAtMs = Date.UTC(2026, 4, 8, 14, 0, 0);
    const empty: RecordedActivity = {
      id: "empty",
      summary: {
        startedAtMs,
        endedAtMs: startedAtMs + 1000,
        durationS: 1,
        strokeCount: 0,
        avgCadenceSpm: 0,
        avgPaceSecondsPer500m: Number.POSITIVE_INFINITY,
        avgHeartRateBpm: null,
        maxHeartRateBpm: null,
      },
      records: [],
      strokes: [],
    };
    const bytes = encodeActivityToFit(empty);
    const stream = Stream.fromByteArray(bytes);
    expect(Decoder.isFIT(stream)).toBe(true);
    const decoder = new Decoder(stream);
    expect(decoder.checkIntegrity()).toBe(true);
  });
});
