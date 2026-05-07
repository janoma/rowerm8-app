import { mpsToSecondsPer500m } from "@/lib/units";

import {
  DEFAULT_METERS_PER_STROKE,
  estimateBoatSpeedMps,
  estimatePaceSecondsPer500m,
} from "@/lib/stroke/pace";

describe("estimateBoatSpeedMps", () => {
  it("uses cadence * metersPerStroke / 60 with the default constant", () => {
    // 30 spm * 8 m/stroke / 60 = 4 m/s.
    expect(estimateBoatSpeedMps(30)).toBeCloseTo(4, 9);
    expect(DEFAULT_METERS_PER_STROKE).toBe(8);
  });

  it("uses caller-supplied metersPerStroke when provided", () => {
    // 30 spm * 10 m/stroke / 60 = 5 m/s.
    expect(estimateBoatSpeedMps(30, { metersPerStroke: 10 })).toBeCloseTo(5, 9);
  });

  it.each([0, -1, NaN, Number.POSITIVE_INFINITY])(
    "returns 0 for non-positive / non-finite cadence (%p)",
    (c) => {
      // Infinity is technically finite-checked separately; only non-finite
      // values should hit the early-out, and Infinity is non-finite.
      expect(estimateBoatSpeedMps(c)).toBe(0);
    },
  );

  it("returns 0 when metersPerStroke is non-positive or non-finite", () => {
    expect(estimateBoatSpeedMps(30, { metersPerStroke: 0 })).toBe(0);
    expect(estimateBoatSpeedMps(30, { metersPerStroke: -5 })).toBe(0);
    expect(estimateBoatSpeedMps(30, { metersPerStroke: NaN })).toBe(0);
  });
});

describe("estimatePaceSecondsPer500m", () => {
  it("matches mpsToSecondsPer500m of estimateBoatSpeedMps", () => {
    const cadence = 28;
    const expected = mpsToSecondsPer500m(estimateBoatSpeedMps(cadence));
    expect(estimatePaceSecondsPer500m(cadence)).toBe(expected);
  });

  it("golden value at 20 spm with default 8 m/stroke", () => {
    // 20 spm * 8 / 60 = 2.667 m/s -> 500 / 2.667 = 187.5 s/500m.
    expect(estimatePaceSecondsPer500m(20)).toBeCloseTo(187.5, 5);
  });

  it("returns Infinity for non-positive cadence so formatPace renders '—'", () => {
    expect(estimatePaceSecondsPer500m(0)).toBe(Number.POSITIVE_INFINITY);
    expect(estimatePaceSecondsPer500m(-1)).toBe(Number.POSITIVE_INFINITY);
    expect(estimatePaceSecondsPer500m(NaN)).toBe(Number.POSITIVE_INFINITY);
  });

  it("respects metersPerStroke override", () => {
    // 30 spm * 10 / 60 = 5 m/s -> 500 / 5 = 100 s/500m.
    expect(estimatePaceSecondsPer500m(30, { metersPerStroke: 10 })).toBeCloseTo(
      100,
      9,
    );
  });
});
