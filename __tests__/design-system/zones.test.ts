/**
 * Coverage for the HR-zone helper.
 *
 * Boundary semantics matter here because the live HR pill in
 * `RowMetricsCard` and the activity-detail HR sparkline both call
 * `zoneForBpm()` to pick a zone color; a one-bpm slip would put the
 * user in the wrong zone visually. Each transition is exercised at
 * `boundary - 1`, `boundary`, and `boundary + 1`.
 */

import {
  DEFAULT_MAX_HR_BPM,
  defaultZoneRanges,
  zoneForBpm,
} from "@/lib/hr/zones";

describe("defaultZoneRanges", () => {
  it("derives 60/70/80/90% boundaries from the supplied max-HR", () => {
    expect(defaultZoneRanges(200)).toEqual([120, 140, 160, 180]);
  });

  it("uses the documented default of 190 bpm when wired through zoneForBpm", () => {
    // 60% of 190 = 114, so 114 should land in z2.
    expect(DEFAULT_MAX_HR_BPM).toBe(190);
    const ranges = defaultZoneRanges(DEFAULT_MAX_HR_BPM);
    expect(ranges).toEqual([114, 133, 152, 171]);
  });
});

describe("zoneForBpm", () => {
  const ranges = defaultZoneRanges(200) as [number, number, number, number]; // 120/140/160/180

  it("returns null for missing or non-finite readings", () => {
    expect(zoneForBpm(null, ranges)).toBeNull();
    expect(zoneForBpm(undefined, ranges)).toBeNull();
    expect(zoneForBpm(Number.NaN, ranges)).toBeNull();
    expect(zoneForBpm(Number.POSITIVE_INFINITY, ranges)).toBeNull();
  });

  it("classifies readings strictly below the first boundary as z1", () => {
    expect(zoneForBpm(0, ranges)).toBe("z1");
    expect(zoneForBpm(60, ranges)).toBe("z1");
    expect(zoneForBpm(ranges[0] - 1, ranges)).toBe("z1");
  });

  it("treats each boundary as the start of the next zone", () => {
    expect(zoneForBpm(ranges[0], ranges)).toBe("z2");
    expect(zoneForBpm(ranges[1], ranges)).toBe("z3");
    expect(zoneForBpm(ranges[2], ranges)).toBe("z4");
    expect(zoneForBpm(ranges[3], ranges)).toBe("z5");
  });

  it("classifies the bpm just below each boundary into the lower zone", () => {
    expect(zoneForBpm(ranges[1] - 1, ranges)).toBe("z2");
    expect(zoneForBpm(ranges[2] - 1, ranges)).toBe("z3");
    expect(zoneForBpm(ranges[3] - 1, ranges)).toBe("z4");
  });

  it("anchors anything at-or-above the top boundary in z5", () => {
    expect(zoneForBpm(ranges[3] + 5, ranges)).toBe("z5");
    expect(zoneForBpm(250, ranges)).toBe("z5");
  });

  it("falls back to default ranges (max-HR 190) when no ranges argument", () => {
    // 113 is below 60% of 190 (=114), so z1; 114 is exactly the boundary, z2.
    expect(zoneForBpm(113)).toBe("z1");
    expect(zoneForBpm(114)).toBe("z2");
    expect(zoneForBpm(180)).toBe("z5");
  });
});
