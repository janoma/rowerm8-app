import {
  createActivityRecorder,
  RECORD_INTERVAL_MS,
} from "@/lib/activity/recorder";

const t0 = 1_700_000_000_000;

function snap(
  overrides: Partial<{
    cadenceSpm: number;
    paceSecondsPer500m: number;
    strokeCount: number;
    heartRateBpm: number | null;
  }> = {},
) {
  return {
    cadenceSpm: 0,
    paceSecondsPer500m: Number.POSITIVE_INFINITY,
    strokeCount: 0,
    heartRateBpm: null as number | null,
    ...overrides,
  };
}

describe("activity recorder", () => {
  it("starts in the stopped state with no records", () => {
    const r = createActivityRecorder();
    expect(r.isRunning).toBe(false);
    expect(r.recordCount).toBe(0);
  });

  it("ignores tick() and markStroke() before start()", () => {
    const r = createActivityRecorder();
    r.tick(snap({ cadenceSpm: 24 }), t0);
    r.markStroke(24, t0);
    expect(r.recordCount).toBe(0);
    expect(() => r.finish(t0)).toThrow();
  });

  it("throttles snapshots to roughly once per RECORD_INTERVAL_MS", () => {
    const r = createActivityRecorder();
    r.start(t0);
    // 60 Hz of ticks across one second should produce 1 snapshot, not 60.
    for (let i = 0; i < 60; i++) {
      r.tick(snap({ cadenceSpm: 24 }), t0 + i * (1000 / 60));
    }
    expect(r.recordCount).toBe(1);

    // After another full interval, accept exactly one more.
    r.tick(snap({ cadenceSpm: 26 }), t0 + RECORD_INTERVAL_MS);
    expect(r.recordCount).toBe(2);
  });

  it("records elapsed seconds relative to the start moment", () => {
    const r = createActivityRecorder();
    r.start(t0);
    r.tick(snap({ cadenceSpm: 24 }), t0);
    r.tick(snap({ cadenceSpm: 24 }), t0 + RECORD_INTERVAL_MS);
    r.tick(snap({ cadenceSpm: 24 }), t0 + 2 * RECORD_INTERVAL_MS);
    const result = r.finish(t0 + 3 * RECORD_INTERVAL_MS);
    expect(result.records.map((s) => s.elapsedS)).toEqual([0, 1, 2]);
    expect(result.summary.durationS).toBe(3);
  });

  it("records stroke events with elapsed timestamps", () => {
    const r = createActivityRecorder();
    r.start(t0);
    r.markStroke(24, t0 + 500);
    r.markStroke(26, t0 + 1500);
    const result = r.finish(t0 + 2000);
    expect(result.strokes).toEqual([
      { elapsedS: 0.5, cadenceSpm: 24 },
      { elapsedS: 1.5, cadenceSpm: 26 },
    ]);
  });

  it("computes avg cadence ignoring pre-stroke zeros", () => {
    const r = createActivityRecorder();
    r.start(t0);
    r.tick(snap({ cadenceSpm: 0 }), t0);
    r.tick(snap({ cadenceSpm: 24 }), t0 + RECORD_INTERVAL_MS);
    r.tick(snap({ cadenceSpm: 28 }), t0 + 2 * RECORD_INTERVAL_MS);
    const result = r.finish(t0 + 3 * RECORD_INTERVAL_MS);
    expect(result.summary.avgCadenceSpm).toBe(26);
  });

  it("computes avg pace ignoring infinity sentinels", () => {
    const r = createActivityRecorder();
    r.start(t0);
    r.tick(snap({ paceSecondsPer500m: Number.POSITIVE_INFINITY }), t0);
    r.tick(snap({ paceSecondsPer500m: 120 }), t0 + RECORD_INTERVAL_MS);
    r.tick(snap({ paceSecondsPer500m: 130 }), t0 + 2 * RECORD_INTERVAL_MS);
    const result = r.finish(t0 + 3 * RECORD_INTERVAL_MS);
    expect(result.summary.avgPaceSecondsPer500m).toBe(125);
  });

  it("aggregates HR into avg/max and leaves null when no readings arrive", () => {
    const r = createActivityRecorder();
    r.start(t0);
    r.tick(snap({ heartRateBpm: null }), t0);
    r.tick(snap({ heartRateBpm: 110 }), t0 + RECORD_INTERVAL_MS);
    r.tick(snap({ heartRateBpm: 130 }), t0 + 2 * RECORD_INTERVAL_MS);
    const result = r.finish(t0 + 3 * RECORD_INTERVAL_MS);
    expect(result.summary.avgHeartRateBpm).toBe(120);
    expect(result.summary.maxHeartRateBpm).toBe(130);

    const r2 = createActivityRecorder();
    r2.start(t0);
    r2.tick(snap({ heartRateBpm: null }), t0);
    const result2 = r2.finish(t0 + RECORD_INTERVAL_MS);
    expect(result2.summary.avgHeartRateBpm).toBeNull();
    expect(result2.summary.maxHeartRateBpm).toBeNull();
  });

  it("derives stroke count from the larger of snapshots and explicit events", () => {
    const r = createActivityRecorder();
    r.start(t0);
    // Snapshot says 3 strokes, but we also explicitly marked 5 events
    // (e.g. some happened between snapshots). The summary reports 5.
    r.markStroke(20, t0 + 100);
    r.markStroke(22, t0 + 300);
    r.markStroke(24, t0 + 500);
    r.markStroke(24, t0 + 700);
    r.markStroke(26, t0 + 900);
    r.tick(snap({ strokeCount: 3, cadenceSpm: 24 }), t0);
    const result = r.finish(t0 + RECORD_INTERVAL_MS);
    expect(result.summary.strokeCount).toBe(5);
  });

  it("returns a stable, sortable id and clears state on finish", () => {
    const r = createActivityRecorder();
    r.start(t0);
    r.tick(snap({ cadenceSpm: 24 }), t0);
    const a = r.finish(t0 + RECORD_INTERVAL_MS);
    expect(a.id.startsWith(`${t0}-`)).toBe(true);
    expect(r.isRunning).toBe(false);
    expect(r.recordCount).toBe(0);
  });
});
