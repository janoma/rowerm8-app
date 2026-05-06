import { joulesToKcal } from "@/lib/units";

import type { ResolvedFormatPrefs } from "./types";

/**
 * Energy is stored as joules (SI) and shown as kilocalories everywhere.
 * "kcal" is the conventional sport-app unit regardless of region.
 */
export function formatEnergy(
  joules: number,
  prefs: Pick<ResolvedFormatPrefs, "locale">,
): string {
  if (!Number.isFinite(joules)) {
    return "—";
  }
  return (
    new Intl.NumberFormat(prefs.locale, {
      maximumFractionDigits: 0,
    }).format(joulesToKcal(joules)) + " kcal"
  );
}
