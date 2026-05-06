import { celsiusToFahrenheit } from "@/lib/units";

import type { ResolvedFormatPrefs } from "./types";

export function formatTemperature(
  celsius: number,
  prefs: Pick<ResolvedFormatPrefs, "locale" | "temperatureUnit">,
): string {
  if (!Number.isFinite(celsius)) {
    return "—";
  }
  if (prefs.temperatureUnit === "F") {
    return new Intl.NumberFormat(prefs.locale, {
      style: "unit",
      unit: "fahrenheit",
      unitDisplay: "short",
      maximumFractionDigits: 0,
    }).format(celsiusToFahrenheit(celsius));
  }
  return new Intl.NumberFormat(prefs.locale, {
    style: "unit",
    unit: "celsius",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(celsius);
}
