import { metersToKilometers, metersToMiles, metersToYards } from "@/lib/units";

import type { ResolvedFormatPrefs } from "./types";

/**
 * Format an SI distance (metres) as a localized display string. Picks the
 * unit and precision based on `prefs.measurementSystem` and the magnitude
 * of the value:
 *
 *   - metric:    < 1 km  -> "350 m";       >= 1 km   -> "12.4 km"
 *   - imperial:  < 1 mi  -> "412 yd";      >= 1 mi   -> "7.7 mi"
 *
 * `Intl.NumberFormat({ style: "unit" })` handles localization of the unit
 * string and the digit grouping.
 */
export function formatDistance(
  meters: number,
  prefs: Pick<ResolvedFormatPrefs, "locale" | "measurementSystem">,
): string {
  if (!Number.isFinite(meters)) {
    return "—";
  }

  if (prefs.measurementSystem === "imperialUS") {
    const miles = metersToMiles(meters);
    if (Math.abs(miles) < 1) {
      return formatUnit(prefs.locale, metersToYards(meters), "yard", 0);
    }
    return formatUnit(prefs.locale, miles, "mile", miles >= 100 ? 1 : 2);
  }

  const km = metersToKilometers(meters);
  if (Math.abs(km) < 1) {
    return formatUnit(prefs.locale, meters, "meter", 0);
  }
  return formatUnit(prefs.locale, km, "kilometer", km >= 100 ? 1 : 2);
}

function formatUnit(
  locale: string,
  value: number,
  unit: string,
  fractionDigits: number,
): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}
