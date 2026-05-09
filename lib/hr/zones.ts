/**
 * Heart-rate zone helpers.
 *
 * Splits a continuous HR (bpm) reading into the 5-zone Garmin ramp
 * defined in `lib/design-system/tokens/hr-zones`. The ranges
 * themselves are *intentionally* parameterized: a `defaultZoneRanges`
 * helper builds the standard 60/70/80/90% × max-HR thresholds from a
 * user's max heart rate.
 *
 * **Max-HR setting is deferred** to a follow-up PR — see the Risks
 * section of the design-system plan. This module exposes a
 * `DEFAULT_MAX_HR_BPM` constant the UI layer can use as a fallback
 * until that PR lands.
 */

import { type HrZoneKey } from "@/lib/design-system";

/**
 * Hard-coded fallback for users who have not yet set a max HR. This
 * is roughly the average for an active 30-year-old (220 - 30 = 190).
 * Replace with a user-configurable setting in the follow-up PR.
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
