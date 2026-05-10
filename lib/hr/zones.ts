/**
 * Heart-rate zone helpers.
 *
 * Two zone models live side by side:
 *
 *   - Garmin/Polar 5-zone, by % of max HR ({@link defaultZoneRanges},
 *     {@link zoneForBpm}).
 *   - Coggan/Friel 7-zone, by % of LTHR ({@link cogganZoneRanges},
 *     {@link cogganZoneForBpm}).
 *
 * The functions are pure and deterministic. The active model lives
 * in the user profile (`useProfile().resolved.hrZoneModel`); UI code
 * picks the right pair via `hooks/use-hr-zone-resolver`.
 *
 * `DEFAULT_MAX_HR_BPM` is the seed value the profile resolver falls
 * back to when the user hasn't configured a max HR yet — UI code
 * should generally read `useProfile().resolved.maxHrBpm`.
 */

import { type CogganZoneKey, type HrZoneKey } from "@/lib/design-system";

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

/**
 * Six boundaries between the seven Coggan/Friel zones, in absolute
 * bpm. A reading at or above the i-th boundary belongs to zone (i+2);
 * readings below the first boundary are zone 1 (Recovery).
 */
export type CogganZoneRanges = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * Joel Friel's HR-zone adaptation of Andrew Coggan's power zones.
 * Boundaries are taken at LTHR fractions:
 *
 *   - Z1 Recovery:           < 85% LTHR
 *   - Z2 Aerobic:            85–89%
 *   - Z3 Tempo:              90–94%
 *   - Z4 SubThreshold:       95–99%
 *   - Z5a SuperThreshold:    100–102%
 *   - Z5b Aerobic Capacity:  103–106%
 *   - Z5c Anaerobic Capacity: ≥ 107%
 *
 * The integer rounding here mirrors what Friel's published tables
 * do — every breakpoint lands on a whole bpm value so display
 * boundaries don't sit between reportable HR samples.
 */
export function cogganZoneRanges(lthrBpm: number): CogganZoneRanges {
  const r = (pct: number) => Math.round(lthrBpm * pct);
  return [r(0.85), r(0.9), r(0.95), r(1.0), r(1.03), r(1.07)];
}

/**
 * Map a bpm reading to one of the seven Coggan/Friel zones. Same
 * null-input contract as {@link zoneForBpm}.
 */
export function cogganZoneForBpm(
  bpm: number | null | undefined,
  ranges: CogganZoneRanges,
): CogganZoneKey | null {
  if (bpm == null || !Number.isFinite(bpm)) {
    return null;
  }
  if (bpm < ranges[0]) {
    return "c1";
  }
  if (bpm < ranges[1]) {
    return "c2";
  }
  if (bpm < ranges[2]) {
    return "c3";
  }
  if (bpm < ranges[3]) {
    return "c4";
  }
  if (bpm < ranges[4]) {
    return "c5a";
  }
  if (bpm < ranges[5]) {
    return "c5b";
  }
  return "c5c";
}
