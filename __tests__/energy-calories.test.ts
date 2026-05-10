/**
 * @jest-environment node
 *
 * Spot-checks against the Keytel et al. 2005 formula and the
 * integrator that drives the cumulative calorie total on the Free
 * Row screen.
 */
import { accumulateKcal, keytelKcalPerMinute } from "@/lib/energy/calories";

describe("keytelKcalPerMinute", () => {
  it("matches the male formula for a 70 kg, 30 yo at 130 bpm", () => {
    // Hand-computed reference:
    //   kJ/min = -55.0969 + 0.6309·130 + 0.1988·70 + 0.2017·30
    //          = -55.0969 + 82.017 + 13.916 + 6.051 = 46.8871
    //   kcal/min = 46.8871 / 4.184 ≈ 11.207
    expect(
      keytelKcalPerMinute({
        hrBpm: 130,
        weightKg: 70,
        ageYears: 30,
        sex: "male",
      }),
    ).toBeCloseTo(11.207, 2);
  });

  it("matches the female formula for a 60 kg, 30 yo at 130 bpm", () => {
    // Hand-computed reference:
    //   kJ/min = -20.4022 + 0.4472·130 - 0.1263·60 + 0.0740·30
    //          = -20.4022 + 58.136 - 7.578 + 2.22 = 32.3758
    //   kcal/min = 32.3758 / 4.184 ≈ 7.738
    expect(
      keytelKcalPerMinute({
        hrBpm: 130,
        weightKg: 60,
        ageYears: 30,
        sex: "female",
      }),
    ).toBeCloseTo(7.738, 2);
  });

  it("returns 0 for non-finite or non-positive HR", () => {
    const profile = { weightKg: 70, ageYears: 30, sex: "male" as const };
    expect(keytelKcalPerMinute({ hrBpm: 0, ...profile })).toBe(0);
    expect(keytelKcalPerMinute({ hrBpm: -10, ...profile })).toBe(0);
    expect(keytelKcalPerMinute({ hrBpm: Number.NaN, ...profile })).toBe(0);
  });

  it("clamps unrealistically-low combinations to 0", () => {
    // Light woman, very low HR — the formula returns slightly negative
    // kJ/min, which would erode the cumulative total. We clamp.
    expect(
      keytelKcalPerMinute({
        hrBpm: 40,
        weightKg: 50,
        ageYears: 18,
        sex: "female",
      }),
    ).toBe(0);
  });
});

describe("accumulateKcal", () => {
  const profile = { weightKg: 70, ageYears: 30, sex: "male" as const };

  it("integrates linearly over time", () => {
    const kcalPerMin = keytelKcalPerMinute({ hrBpm: 130, ...profile });
    // 10 minutes at the same HR ≈ 10 · kcalPerMin
    let total = 0;
    for (let i = 0; i < 600; i += 1) {
      total = accumulateKcal(total, 130, 1, profile);
    }
    expect(total).toBeCloseTo(kcalPerMin * 10, 3);
  });

  it("leaves the total unchanged when HR is null or invalid", () => {
    expect(accumulateKcal(42, null, 1, profile)).toBe(42);
    expect(accumulateKcal(42, undefined, 1, profile)).toBe(42);
    expect(accumulateKcal(42, Number.NaN, 1, profile)).toBe(42);
    expect(accumulateKcal(42, 130, 0, profile)).toBe(42);
    expect(accumulateKcal(42, 130, -5, profile)).toBe(42);
  });

  it("treats a negative or non-finite seed as 0", () => {
    const out = accumulateKcal(-10, 130, 60, profile);
    expect(out).toBeGreaterThan(0);
    expect(accumulateKcal(Number.NaN, 130, 60, profile)).toBeGreaterThan(0);
  });
});
