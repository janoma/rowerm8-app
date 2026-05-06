/**
 * Exact SI conversion constants.
 *
 * Every value is the *number of SI base units per non-SI unit*. Conversions
 * are then trivially `siValue / FOO_PER_BAR` or `displayValue * FOO_PER_BAR`.
 *
 * These are *exact* by international agreement (NIST SP 811). Do not
 * "round" them or introduce parallel approximations elsewhere — drift in
 * stored data is avoided by always converting through these constants and
 * never round-tripping (see `lib/units/README` and `lib/format`).
 */

export const METERS_PER_KILOMETER = 1000 as const;
export const METERS_PER_MILE = 1609.344 as const;
export const METERS_PER_YARD = 0.9144 as const;
export const METERS_PER_FOOT = 0.3048 as const;

export const KG_PER_POUND = 0.45359237 as const;
export const KG_PER_STONE = 6.35029318 as const;

/** kcal -> J (thermochemical calorie). Energy in our model is stored in J. */
export const JOULES_PER_KCAL = 4184 as const;

export const SECONDS_PER_MINUTE = 60 as const;
export const SECONDS_PER_HOUR = 3600 as const;

/** Standard gravity. Used to normalize raw accelerometer "g" readings to m/s^2. */
export const GRAVITY_MPS2 = 9.80665 as const;
