/**
 * @jest-environment node
 */
import { Decoder, Stream } from "@garmin/fitsdk";

import {
  encodeActivityToFit,
  SPEED_ESTIMATION_DISCLOSURE,
} from "@/lib/activity/fit-writer";
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
    caloriesKcal: i < 30 ? null : Math.min(120, i * 0.18),
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
      totalCaloriesKcal: records[records.length - 1].caloriesKcal,
    },
    records,
    strokes: Array.from({ length: 240 }, (_, i) => ({
      elapsedS: i * 2.5,
      cadenceSpm: 24,
    })),
    pauses: [],
  };
}

function decodeMessages(activity: RecordedActivity) {
  const bytes = encodeActivityToFit(activity);
  const stream = Stream.fromByteArray(bytes);
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read();
  expect(errors).toEqual([]);
  return messages;
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
        totalCaloriesKcal: null,
      },
      records: [],
      strokes: [],
      pauses: [],
    };
    const bytes = encodeActivityToFit(empty);
    const stream = Stream.fromByteArray(bytes);
    expect(Decoder.isFIT(stream)).toBe(true);
    const decoder = new Decoder(stream);
    expect(decoder.checkIntegrity()).toBe(true);
    const { messages } = decoder.read();
    const session = messages.sessionMesgs?.[0] as Record<string, unknown>;
    expect(session.totalDistance ?? 0).toBe(0);
  });

  it("writes a cumulative distance on every record", () => {
    const messages = decodeMessages(fixtureActivity());
    const records = (messages.recordMesgs ?? []) as Record<string, unknown>[];
    expect(records.length).toBe(600);

    let prev = -Infinity;
    for (const r of records) {
      const d = r.distance as number;
      expect(typeof d).toBe("number");
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(records[0].distance).toBe(0);
    expect(prev).toBeGreaterThan(1000);
  });

  it("syncs totalDistance on LAP and SESSION with the final record distance", () => {
    const messages = decodeMessages(fixtureActivity());
    const records = (messages.recordMesgs ?? []) as Record<string, unknown>[];
    const finalDistance = records[records.length - 1].distance as number;
    const session = messages.sessionMesgs?.[0] as Record<string, unknown>;
    const lap = messages.lapMesgs?.[0] as Record<string, unknown>;
    expect(session.totalDistance).toBeCloseTo(finalDistance, 1);
    expect(lap.totalDistance).toBeCloseTo(finalDistance, 1);
  });

  it("contributes zero distance when every record has zero speed", () => {
    const startedAtMs = Date.UTC(2026, 4, 8, 14, 0, 0);
    const records = Array.from({ length: 30 }, (_, i) => ({
      elapsedS: i,
      cadenceSpm: 0,
      paceSecondsPer500m: 0,
      strokeCount: 0,
      heartRateBpm: null,
      caloriesKcal: null,
    }));
    const activity: RecordedActivity = {
      id: "still",
      summary: {
        startedAtMs,
        endedAtMs: startedAtMs + 30_000,
        durationS: 30,
        strokeCount: 0,
        avgCadenceSpm: 0,
        avgPaceSecondsPer500m: 0,
        avgHeartRateBpm: null,
        maxHeartRateBpm: null,
        totalCaloriesKcal: null,
      },
      records,
      strokes: [],
      pauses: [],
    };
    const messages = decodeMessages(activity);
    const recs = (messages.recordMesgs ?? []) as Record<string, unknown>[];
    for (const r of recs) {
      expect(r.distance ?? 0).toBe(0);
    }
    const session = messages.sessionMesgs?.[0] as Record<string, unknown>;
    expect(session.totalDistance ?? 0).toBe(0);
  });

  it("identifies the recorder as RowerM8 (est. pace)", () => {
    const messages = decodeMessages(fixtureActivity());
    const deviceInfo = (messages.deviceInfoMesgs ?? []) as Record<
      string,
      unknown
    >[];
    const creator =
      deviceInfo.find((d) => d.deviceIndex === "creator") ?? deviceInfo[0];
    expect(creator?.productName).toBe("RowerM8 (est. pace)");
  });

  it("emits timer/stop and timer/start events for each pause window", () => {
    const startedAtMs = Date.UTC(2026, 4, 8, 14, 0, 0);
    const durationS = 60;
    const activity: RecordedActivity = {
      id: "paused",
      summary: {
        startedAtMs,
        endedAtMs: startedAtMs + durationS * 1000,
        durationS: 50,
        strokeCount: 12,
        avgCadenceSpm: 24,
        avgPaceSecondsPer500m: 130,
        avgHeartRateBpm: null,
        maxHeartRateBpm: null,
        totalCaloriesKcal: null,
      },
      records: Array.from({ length: durationS }, (_, i) => ({
        elapsedS: i,
        cadenceSpm: 24,
        paceSecondsPer500m: 130,
        strokeCount: Math.floor((i * 24) / 60),
        heartRateBpm: null,
        caloriesKcal: null,
      })),
      strokes: [],
      pauses: [{ startElapsedS: 20, endElapsedS: 30 }],
    };
    const messages = decodeMessages(activity);
    const events = (messages.eventMesgs ?? []) as Record<string, unknown>[];
    const timerEvents = events.filter((e) => e.event === "timer");
    const eventTypes = timerEvents.map((e) => e.eventType);
    // Expect: start (initial), stopAll (pause begin), start (resume), stopAll (final).
    expect(eventTypes).toEqual(["start", "stopAll", "start", "stopAll"]);
  });

  it("uses moving-time dt for distance integration across pauses", () => {
    const startedAtMs = Date.UTC(2026, 4, 8, 14, 0, 0);
    const cadence = 30;
    const pace = 120; // 500 / 120 = ~4.167 m/s
    const records = Array.from({ length: 20 }, (_, i) => ({
      elapsedS: i,
      cadenceSpm: cadence,
      paceSecondsPer500m: pace,
      strokeCount: Math.floor((i * cadence) / 60),
      heartRateBpm: null,
      caloriesKcal: null,
    }));
    const withoutPause: RecordedActivity = {
      id: "no-pause",
      summary: {
        startedAtMs,
        endedAtMs: startedAtMs + 19_000,
        durationS: 19,
        strokeCount: records[records.length - 1].strokeCount,
        avgCadenceSpm: cadence,
        avgPaceSecondsPer500m: pace,
        avgHeartRateBpm: null,
        maxHeartRateBpm: null,
        totalCaloriesKcal: null,
      },
      records,
      strokes: [],
      pauses: [],
    };
    const withPause: RecordedActivity = {
      ...withoutPause,
      id: "pause",
      summary: {
        ...withoutPause.summary,
        durationS: 14,
      },
      pauses: [{ startElapsedS: 9, endElapsedS: 14 }],
    };
    const totalOf = (a: RecordedActivity) => {
      const m = decodeMessages(a);
      return (m.sessionMesgs?.[0] as Record<string, unknown>)
        .totalDistance as number;
    };
    const noPauseTotal = totalOf(withoutPause);
    const pauseTotal = totalOf(withPause);
    // 5 s of pause at ~4.167 m/s would add ~20.8 m if we ignored pauses;
    // the moving-time integrator should subtract that out.
    expect(noPauseTotal - pauseTotal).toBeGreaterThan(15);
    expect(noPauseTotal - pauseTotal).toBeLessThan(30);
  });

  it("writes per-record calories and a totalCalories on LAP/SESSION", () => {
    const messages = decodeMessages(fixtureActivity());
    const records = (messages.recordMesgs ?? []) as Record<string, unknown>[];
    // Records with no calorie data omit the field; records that did have
    // a value should carry a non-zero kcal count.
    expect(records[0].calories ?? 0).toBe(0);
    const lateRecord = records[400];
    expect(typeof lateRecord.calories).toBe("number");
    expect(lateRecord.calories as number).toBeGreaterThan(0);

    const lap = messages.lapMesgs?.[0] as Record<string, unknown>;
    const session = messages.sessionMesgs?.[0] as Record<string, unknown>;
    expect(typeof lap.totalCalories).toBe("number");
    expect(typeof session.totalCalories).toBe("number");
    expect(lap.totalCalories as number).toBeGreaterThan(0);
    expect(session.totalCalories).toBe(lap.totalCalories);
  });

  it("omits totalCalories when the activity has no HR/calorie data", () => {
    const startedAtMs = Date.UTC(2026, 4, 8, 14, 0, 0);
    const noHr: RecordedActivity = {
      id: "no-hr",
      summary: {
        startedAtMs,
        endedAtMs: startedAtMs + 60_000,
        durationS: 60,
        strokeCount: 24,
        avgCadenceSpm: 24,
        avgPaceSecondsPer500m: 130,
        avgHeartRateBpm: null,
        maxHeartRateBpm: null,
        totalCaloriesKcal: null,
      },
      records: Array.from({ length: 60 }, (_, i) => ({
        elapsedS: i,
        cadenceSpm: 24,
        paceSecondsPer500m: 130,
        strokeCount: Math.floor((i * 24) / 60),
        heartRateBpm: null,
        caloriesKcal: null,
      })),
      strokes: [],
      pauses: [],
    };
    const messages = decodeMessages(noHr);
    const lap = messages.lapMesgs?.[0] as Record<string, unknown>;
    const session = messages.sessionMesgs?.[0] as Record<string, unknown>;
    expect(lap.totalCalories).toBeUndefined();
    expect(session.totalCalories).toBeUndefined();
    const records = (messages.recordMesgs ?? []) as Record<string, unknown>[];
    for (const r of records) {
      expect(r.calories).toBeUndefined();
    }
  });

  it("emits an estimation-note developer field on the SESSION", () => {
    const messages = decodeMessages(fixtureActivity());
    expect(messages.developerDataIdMesgs?.length).toBeGreaterThanOrEqual(1);
    expect(messages.fieldDescriptionMesgs?.length).toBeGreaterThanOrEqual(1);

    const fieldDesc = (messages.fieldDescriptionMesgs ?? [])[0] as Record<
      string,
      unknown
    >;
    const fieldName = Array.isArray(fieldDesc.fieldName)
      ? fieldDesc.fieldName[0]
      : fieldDesc.fieldName;
    expect(fieldName).toBe("estimation_note");

    const session = messages.sessionMesgs?.[0] as Record<string, unknown>;
    const devFields = session.developerFields as
      | Record<string, unknown>
      | undefined;
    expect(devFields).toBeDefined();
    // The decoder keys developer fields by an internal counter rather than
    // the human-readable field name; assert the value round-trips under any
    // key.
    expect(Object.values(devFields ?? {})).toContain(
      SPEED_ESTIMATION_DISCLOSURE,
    );
    expect(SPEED_ESTIMATION_DISCLOSURE).toBe(
      "Speed and pace estimated by RowerM8.",
    );
  });
});
