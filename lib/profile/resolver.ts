/**
 * Pure-logic side of the user profile feature: type shape, documented
 * defaults, plausible-value limits, and a deterministic resolver that
 * turns the on-disk `null`-able preferences into the
 * everything-filled-in form the rest of the app consumes.
 *
 * Lives in `lib/` (not next to the React provider in `contexts/`) so
 * unit tests can run under the node environment without dragging in
 * React Native or the AsyncStorage module.
 */
import { DEFAULT_MAX_HR_BPM } from "@/lib/hr/zones";

export type Sex = "male" | "female";

/**
 * HR-zone display model. The 5-zone Garmin/Polar ramp uses % of max
 * HR; the 7-zone Coggan/Friel ramp uses % of LTHR. The user can flip
 * between them in Settings → Profile; the choice is purely a display
 * concern (saved activities re-render with the active model).
 */
export type HrZoneModel = "garminPolar5" | "cogganFriel7";

/**
 * Raw on-disk profile shape. Every field is nullable: `null` means
 * "use the documented default" so UI rows can show the default value
 * as a subtitle and the user can revert a field without picking a
 * value back.
 */
export type ProfilePrefs = {
  /**
   * Maximum heart rate in bpm. Drives the 5-zone %-of-max ramp. When
   * unset, defaults to {@link DEFAULT_MAX_HR_BPM} (~190).
   */
  maxHrBpm: number | null;
  /**
   * Lactate-threshold heart rate (LTHR) in bpm. Drives the 7-zone
   * %-of-LTHR ramp. When unset, defaults to 85% of resolved max HR
   * (the standard Friel/Coggan starting estimate).
   */
  thresholdHrBpm: number | null;
  /** Body weight in kilograms. Drives the Keytel calorie estimator. */
  weightKg: number | null;
  /** Age in years. Drives the Keytel calorie estimator. */
  ageYears: number | null;
  /** Biological sex used by the Keytel calorie formula. */
  sex: Sex | null;
  /**
   * Active HR-zone model. When unset, defaults to `"garminPolar5"`
   * so zero-config users see today's UX.
   */
  hrZoneModel: HrZoneModel | null;
};

/**
 * Profile with every field filled in. Anything `null` in
 * {@link ProfilePrefs} is replaced by its documented default here.
 */
export type ResolvedProfile = {
  maxHrBpm: number;
  thresholdHrBpm: number;
  weightKg: number;
  ageYears: number;
  sex: Sex;
  hrZoneModel: HrZoneModel;
  /** True when any field has been explicitly user-set (i.e. not null). */
  isCustomized: boolean;
};

export const DEFAULT_PREFS: ProfilePrefs = {
  maxHrBpm: null,
  thresholdHrBpm: null,
  weightKg: null,
  ageYears: null,
  sex: null,
  hrZoneModel: null,
};

/**
 * Defaults applied when a user hasn't filled in a particular field.
 * Centralised so the picker UI, the resolver, and unit tests all read
 * from the same source.
 */
export const PROFILE_DEFAULTS = {
  maxHrBpm: DEFAULT_MAX_HR_BPM,
  weightKg: 75,
  ageYears: 35,
  sex: "male" as Sex,
  /** Threshold defaults to 85% of resolved max HR (see Friel/Coggan). */
  thresholdFractionOfMax: 0.85,
  hrZoneModel: "garminPolar5" as HrZoneModel,
} as const;

/**
 * Plausible value ranges. Used by the input UI to clamp / reject
 * obviously-wrong values; not enforced inside the resolver (so we
 * don't silently drop a value the user typed by mistake).
 */
export const PROFILE_LIMITS = {
  maxHrBpm: { min: 100, max: 230 },
  thresholdHrBpm: { min: 80, max: 220 },
  weightKg: { min: 30, max: 250 },
  ageYears: { min: 10, max: 120 },
} as const;

export function resolveProfile(prefs: ProfilePrefs): ResolvedProfile {
  const maxHrBpm = prefs.maxHrBpm ?? PROFILE_DEFAULTS.maxHrBpm;
  const thresholdHrBpm =
    prefs.thresholdHrBpm ??
    Math.round(maxHrBpm * PROFILE_DEFAULTS.thresholdFractionOfMax);
  const weightKg = prefs.weightKg ?? PROFILE_DEFAULTS.weightKg;
  const ageYears = prefs.ageYears ?? PROFILE_DEFAULTS.ageYears;
  const sex = prefs.sex ?? PROFILE_DEFAULTS.sex;
  const hrZoneModel = prefs.hrZoneModel ?? PROFILE_DEFAULTS.hrZoneModel;
  const isCustomized =
    prefs.maxHrBpm != null ||
    prefs.thresholdHrBpm != null ||
    prefs.weightKg != null ||
    prefs.ageYears != null ||
    prefs.sex != null ||
    prefs.hrZoneModel != null;
  return {
    maxHrBpm,
    thresholdHrBpm,
    weightKg,
    ageYears,
    sex,
    hrZoneModel,
    isCustomized,
  };
}

/**
 * Coerce a (possibly legacy) persisted prefs payload to the current
 * shape. Drops keys we no longer recognise and silently nulls fields
 * whose value is non-finite (e.g. NaN slipped in via a bad picker
 * input).
 */
export function migrateProfilePrefs(
  parsed: Partial<ProfilePrefs> | null | undefined,
): ProfilePrefs {
  const out: ProfilePrefs = { ...DEFAULT_PREFS };
  if (!parsed || typeof parsed !== "object") {
    return out;
  }
  const num = (v: unknown): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return null;
    }
    return v;
  };
  out.maxHrBpm = num(parsed.maxHrBpm);
  out.thresholdHrBpm = num(parsed.thresholdHrBpm);
  out.weightKg = num(parsed.weightKg);
  out.ageYears = num(parsed.ageYears);
  out.sex =
    parsed.sex === "male" || parsed.sex === "female" ? parsed.sex : null;
  out.hrZoneModel =
    parsed.hrZoneModel === "garminPolar5" ||
    parsed.hrZoneModel === "cogganFriel7"
      ? parsed.hrZoneModel
      : null;
  return out;
}
