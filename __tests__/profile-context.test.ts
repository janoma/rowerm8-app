/**
 * @jest-environment node
 *
 * Pure-logic tests for the profile resolver. The provider itself wraps
 * AsyncStorage + React state, which we leave for integration tests;
 * here we just verify the resolver applies the documented defaults
 * and computes the right derived values.
 */
import {
  migrateProfilePrefs,
  PROFILE_DEFAULTS,
  resolveProfile,
  type ProfilePrefs,
} from "@/lib/profile/resolver";
import { DEFAULT_MAX_HR_BPM, defaultZoneRanges } from "@/lib/hr/zones";

function prefs(overrides: Partial<ProfilePrefs> = {}): ProfilePrefs {
  return {
    maxHrBpm: null,
    thresholdHrBpm: null,
    weightKg: null,
    ageYears: null,
    sex: null,
    hrZoneModel: null,
    ...overrides,
  };
}

describe("resolveProfile", () => {
  it("returns documented defaults when every field is null", () => {
    const r = resolveProfile(prefs());
    expect(r.maxHrBpm).toBe(PROFILE_DEFAULTS.maxHrBpm);
    expect(r.maxHrBpm).toBe(DEFAULT_MAX_HR_BPM);
    expect(r.weightKg).toBe(PROFILE_DEFAULTS.weightKg);
    expect(r.ageYears).toBe(PROFILE_DEFAULTS.ageYears);
    expect(r.sex).toBe(PROFILE_DEFAULTS.sex);
    expect(r.hrZoneModel).toBe(PROFILE_DEFAULTS.hrZoneModel);
    expect(r.hrZoneModel).toBe("garminPolar5");
    expect(r.isCustomized).toBe(false);
  });

  it("preserves a user-selected hrZoneModel and flips isCustomized", () => {
    const r = resolveProfile(prefs({ hrZoneModel: "cogganFriel7" }));
    expect(r.hrZoneModel).toBe("cogganFriel7");
    expect(r.isCustomized).toBe(true);
  });

  it("derives threshold HR as ~85% of resolved max HR by default", () => {
    expect(resolveProfile(prefs()).thresholdHrBpm).toBe(
      Math.round(DEFAULT_MAX_HR_BPM * 0.85),
    );
    expect(resolveProfile(prefs({ maxHrBpm: 200 })).thresholdHrBpm).toBe(170);
  });

  it("uses the user-set threshold HR verbatim when provided", () => {
    expect(
      resolveProfile(prefs({ maxHrBpm: 200, thresholdHrBpm: 165 }))
        .thresholdHrBpm,
    ).toBe(165);
  });

  it("flips isCustomized as soon as any field is non-null", () => {
    expect(resolveProfile(prefs({ weightKg: 80 })).isCustomized).toBe(true);
    expect(resolveProfile(prefs({ sex: "female" })).isCustomized).toBe(true);
    expect(resolveProfile(prefs({ ageYears: 42 })).isCustomized).toBe(true);
  });

  it("plays nicely with defaultZoneRanges", () => {
    const ranges = defaultZoneRanges(
      resolveProfile(prefs({ maxHrBpm: 200 })).maxHrBpm,
    );
    expect(ranges).toEqual([120, 140, 160, 180]);
  });
});

describe("migrateProfilePrefs", () => {
  it("returns documented defaults when given null / undefined / corrupt", () => {
    const allNull: ProfilePrefs = {
      maxHrBpm: null,
      thresholdHrBpm: null,
      weightKg: null,
      ageYears: null,
      sex: null,
      hrZoneModel: null,
    };
    expect(migrateProfilePrefs(null)).toEqual(allNull);
    expect(migrateProfilePrefs(undefined)).toEqual(allNull);
  });

  it("drops non-finite numbers and unknown sex values", () => {
    const out = migrateProfilePrefs({
      maxHrBpm: Number.NaN,
      thresholdHrBpm: 165,
      weightKg: Number.POSITIVE_INFINITY,
      ageYears: 30,
      sex: "other" as unknown as "male",
    });
    expect(out.maxHrBpm).toBeNull();
    expect(out.thresholdHrBpm).toBe(165);
    expect(out.weightKg).toBeNull();
    expect(out.ageYears).toBe(30);
    expect(out.sex).toBeNull();
  });

  it("preserves known hrZoneModel values and nulls unknown ones", () => {
    expect(
      migrateProfilePrefs({ hrZoneModel: "garminPolar5" }).hrZoneModel,
    ).toBe("garminPolar5");
    expect(
      migrateProfilePrefs({ hrZoneModel: "cogganFriel7" }).hrZoneModel,
    ).toBe("cogganFriel7");
    expect(
      migrateProfilePrefs({
        hrZoneModel: "polar5" as unknown as "garminPolar5",
      }).hrZoneModel,
    ).toBeNull();
  });

  it("ignores extra keys not in the schema", () => {
    const out = migrateProfilePrefs({
      maxHrBpm: 200,
      // @ts-expect-error intentional extra key
      legacyHeight: 175,
    });
    expect(out.maxHrBpm).toBe(200);
    expect(Object.keys(out).sort()).toEqual(
      [
        "ageYears",
        "hrZoneModel",
        "maxHrBpm",
        "sex",
        "thresholdHrBpm",
        "weightKg",
      ].sort(),
    );
  });
});
