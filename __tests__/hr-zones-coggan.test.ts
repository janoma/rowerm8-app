/**
 * @jest-environment node
 *
 * Pure tests for the Coggan/Friel 7-zone HR helpers. Boundaries are
 * computed at integer-rounded LTHR fractions, matching Friel's
 * published tables.
 */
import { cogganZoneForBpm, cogganZoneRanges } from "@/lib/hr/zones";

describe("cogganZoneRanges", () => {
  it("rounds LTHR fractions to whole bpm", () => {
    // LTHR = 165 → fractions 0.85, 0.90, 0.95, 1.00, 1.03, 1.07.
    // Hand-rounded: 140, 149 (148.5 rounds up), 157, 165, 170, 177.
    expect(cogganZoneRanges(165)).toEqual([140, 149, 157, 165, 170, 177]);
  });

  it("monotonically increases", () => {
    const r = cogganZoneRanges(170);
    for (let i = 1; i < r.length; i += 1) {
      expect(r[i]).toBeGreaterThan(r[i - 1]);
    }
  });
});

describe("cogganZoneForBpm", () => {
  const ranges = cogganZoneRanges(165); // [140, 149, 157, 165, 170, 177]

  it("returns null for null / non-finite bpm", () => {
    expect(cogganZoneForBpm(null, ranges)).toBeNull();
    expect(cogganZoneForBpm(undefined, ranges)).toBeNull();
    expect(cogganZoneForBpm(Number.NaN, ranges)).toBeNull();
  });

  it("classifies values in each band", () => {
    expect(cogganZoneForBpm(120, ranges)).toBe("c1");
    expect(cogganZoneForBpm(145, ranges)).toBe("c2");
    expect(cogganZoneForBpm(150, ranges)).toBe("c3");
    expect(cogganZoneForBpm(160, ranges)).toBe("c4");
    expect(cogganZoneForBpm(167, ranges)).toBe("c5a");
    expect(cogganZoneForBpm(172, ranges)).toBe("c5b");
    expect(cogganZoneForBpm(180, ranges)).toBe("c5c");
  });

  it("uses strict inequality at boundaries (a value at the boundary lands in the upper zone)", () => {
    expect(cogganZoneForBpm(140, ranges)).toBe("c2");
    expect(cogganZoneForBpm(149, ranges)).toBe("c3");
    expect(cogganZoneForBpm(165, ranges)).toBe("c5a");
    expect(cogganZoneForBpm(177, ranges)).toBe("c5c");
  });

  it("treats values at and above the top boundary as c5c", () => {
    expect(cogganZoneForBpm(220, ranges)).toBe("c5c");
  });
});
