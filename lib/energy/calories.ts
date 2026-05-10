/**
 * Heart-rate-based calorie estimation.
 *
 * Uses the Keytel et al. (2005) HR-only formulas, with body weight,
 * age, and biological sex as covariates. The formulas estimate
 * kJ/min; we divide by `JOULES_PER_KCAL / 1000` (= 4.184) to land in
 * dietary kcal/min.
 *
 * Keytel formulas (rounded to the published precision):
 *   male:   kcal/min = (−55.0969 + 0.6309·HR + 0.1988·weight + 0.2017·age) / 4.184
 *   female: kcal/min = (−20.4022 + 0.4472·HR − 0.1263·weight + 0.0740·age) / 4.184
 *
 * The output is clamped to `>= 0` so a low HR combined with a heavy
 * biometric set can't subtract from the cumulative total.
 *
 * No HR → no estimate. The accumulator returns `previousTotal`
 * unchanged when the input HR is null/non-finite, so a brief HRM
 * dropout doesn't reset the count.
 */
import type { Sex } from "@/lib/profile/resolver";

/** Joules per dietary kcal (the factor used in the Keytel formulas). */
const KCAL_PER_KJ = 1 / 4.184;

export type CaloriesProfile = {
  weightKg: number;
  ageYears: number;
  sex: Sex;
};

/**
 * Keytel et al. 2005, eq. 1 (male) / eq. 2 (female). Returns kcal/min
 * for the given instantaneous HR and biometric profile. Clamped to
 * `>= 0`. The function is pure — no clocks, no I/O — so it can be
 * unit-tested against the published example values.
 */
export function keytelKcalPerMinute({
  hrBpm,
  weightKg,
  ageYears,
  sex,
}: CaloriesProfile & { hrBpm: number }): number {
  if (!Number.isFinite(hrBpm) || hrBpm <= 0) {
    return 0;
  }
  const kjPerMin =
    sex === "male"
      ? -55.0969 + 0.6309 * hrBpm + 0.1988 * weightKg + 0.2017 * ageYears
      : -20.4022 + 0.4472 * hrBpm - 0.1263 * weightKg + 0.074 * ageYears;
  return Math.max(0, kjPerMin * KCAL_PER_KJ);
}

/**
 * Integrate one tick's contribution onto a running calorie total.
 *
 * - `previousTotal` is the previous tick's cumulative kcal (≥ 0).
 * - `hrBpm` is the heart rate observed *for this tick*. When null /
 *   non-finite, the function returns `previousTotal` unchanged so an
 *   HRM dropout doesn't add a zero-HR sample to the average.
 * - `dtSeconds` is the seconds elapsed since the previous tick. Pass
 *   the wall-clock dt; we don't model pauses here because the caller
 *   already gates this on `phase === "running"`.
 *
 * Returns the new cumulative kcal.
 */
export function accumulateKcal(
  previousTotal: number,
  hrBpm: number | null | undefined,
  dtSeconds: number,
  profile: CaloriesProfile,
): number {
  const safePrev = Number.isFinite(previousTotal)
    ? Math.max(0, previousTotal)
    : 0;
  if (hrBpm == null || !Number.isFinite(hrBpm) || hrBpm <= 0) {
    return safePrev;
  }
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    return safePrev;
  }
  const kcalPerMin = keytelKcalPerMinute({ hrBpm, ...profile });
  return safePrev + (kcalPerMin * dtSeconds) / 60;
}
