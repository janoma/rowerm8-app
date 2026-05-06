import { kilogramsToPounds } from "@/lib/units";

import type { ResolvedFormatPrefs } from "./types";

/**
 * Format a body weight (or any mass) given in kilograms. Honors the user's
 * explicit weight preference; if not specified separately, falls back to
 * the measurement system.
 */
export function formatWeight(
  kg: number,
  prefs: Pick<ResolvedFormatPrefs, "locale" | "weightUnit">,
): string {
  if (!Number.isFinite(kg)) {
    return "—";
  }

  if (prefs.weightUnit === "lb") {
    return new Intl.NumberFormat(prefs.locale, {
      style: "unit",
      unit: "pound",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(kilogramsToPounds(kg));
  }

  return new Intl.NumberFormat(prefs.locale, {
    style: "unit",
    unit: "kilogram",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(kg);
}
