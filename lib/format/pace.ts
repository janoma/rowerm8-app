import {
  mpsToSecondsPer500m,
  secondsPer500mToSecondsPerKm,
  secondsPer500mToSecondsPerMile,
} from "@/lib/units";

import { formatPaceFromSeconds } from "./time";
import type { ResolvedFormatPrefs } from "./types";

/**
 * Format a SI speed (m/s) as a pace string in the user's preferred pace
 * unit. Pace is decoupled from the measurement system because rowing
 * convention is per-500m regardless of distance units.
 *
 * Speeds at or below zero render as "—" rather than `Infinity`; this is the
 * conventional placeholder for "not yet rowing".
 */
export function formatPace(
  mps: number,
  prefs: Pick<ResolvedFormatPrefs, "locale" | "paceUnit">,
): string {
  if (!Number.isFinite(mps) || mps <= 0) {
    return "—";
  }

  const sp500 = mpsToSecondsPer500m(mps);

  switch (prefs.paceUnit) {
    case "perKm": {
      return formatPaceFromSeconds(
        secondsPer500mToSecondsPerKm(sp500),
        unitSuffix(prefs.locale, "kilometer"),
      );
    }
    case "perMile": {
      return formatPaceFromSeconds(
        secondsPer500mToSecondsPerMile(sp500),
        unitSuffix(prefs.locale, "mile"),
      );
    }
    case "per500m":
    default: {
      // 500m is not a recognized unit in Intl, so we render it manually.
      // `Intl.NumberFormat` with `style: "unit"` for `"meter"` would print
      // "500 m" with the localized digit grouping, which we replicate.
      const meters = new Intl.NumberFormat(prefs.locale).format(500);
      return formatPaceFromSeconds(sp500, `${meters} m`);
    }
  }
}

function unitSuffix(locale: string, unit: "kilometer" | "mile"): string {
  // Format the value `1` so we can extract just the unit suffix in a
  // locale-correct form (e.g. "km", "mi", "公里").
  const parts = new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
  }).formatToParts(1);
  return parts
    .filter((p) => p.type === "unit" || p.type === "literal")
    .map((p) => p.value)
    .join("")
    .trim();
}
