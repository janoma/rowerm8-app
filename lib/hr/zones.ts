/**
 * Heart-rate zone helpers.
 *
 * Splits a continuous HR (bpm) reading into the 5-zone Garmin ramp
 * defined in `lib/design-system/tokens/hr-zones`. The ranges
 * themselves are *intentionally* parameterized: a `defaultZoneRanges`
 * helper builds the standard 60/70/80/90% × max-HR thresholds from a
 * user's max heart rate. Call sites should pass the user's resolved
 * max HR from `useProfile().resolved.maxHrBpm` — this module's
 * `DEFAULT_MAX_HR_BPM` is the seed value the resolver falls back to
 * when the user hasn't configured one yet.
 */

import { type HrZoneKey } from "@/lib/design-system";

/**
 * Seed fallback consumed by the profile resolver when the user hasn't
 * explicitly set a max HR. ~220 − 30 ≈ 190 — the active-thirties
 * average. The profile context layers user input on top of this; UI
 * code should generally read `useProfile().resolved.maxHrBpm` instead
 * of touching this constant directly.
 */
export const DEFAULT_MAX_HR_BPM = 190;

/**
 * Four boundaries between five zones, expressed as `[z1->z2, z2->z3,
 * z3->z4, z4->z5]` in absolute bpm. A reading at-or-above the i-th
 * boundary belongs to zone (i+2) (since zone 1 is everything below
 * the first boundary).
 */
export type ZoneRanges = readonly [number, number, number, number];

/**
 * Standard %-of-max-HR thresholds (Garmin / Polar convention).
 * Returns absolute bpm boundaries from a max-HR. Rounded to integers
 * so the boundaries align cleanly with displayed bpm values.
 */
export function defaultZoneRanges(maxHrBpm: number): ZoneRanges {
  const r = (pct: number) => Math.round(maxHrBpm * pct);
  return [r(0.6), r(0.7), r(0.8), r(0.9)];
}

/**
 * Map a bpm reading to one of the 5 zones. Returns `null` when the
 * input is null / not finite (so callers can render a missing-data
 * UI without an extra check).
 */
export function zoneForBpm(
  bpm: number | null | undefined,
  ranges: ZoneRanges = defaultZoneRanges(DEFAULT_MAX_HR_BPM),
): HrZoneKey | null {
  if (bpm == null || !Number.isFinite(bpm)) {
    return null;
  }
  if (bpm < ranges[0]) {
    return "z1";
  }
  if (bpm < ranges[1]) {
    return "z2";
  }
  if (bpm < ranges[2]) {
    return "z3";
  }
  if (bpm < ranges[3]) {
    return "z4";
  }
  return "z5";
}
