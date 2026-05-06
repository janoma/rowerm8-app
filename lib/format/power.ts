import type { ResolvedFormatPrefs } from "./types";

/**
 * Format a power value in watts. Power is a universal SI quantity in
 * sport contexts (no metric/imperial split), so this only handles digit
 * grouping and locale-correct unit placement.
 */
export function formatPower(
  watts: number,
  prefs: Pick<ResolvedFormatPrefs, "locale">,
): string {
  if (!Number.isFinite(watts)) {
    return "—";
  }
  return (
    new Intl.NumberFormat(prefs.locale, {
      maximumFractionDigits: 0,
    }).format(watts) + " W"
  );
}

/**
 * Stroke rate (strokes/min). No localized unit exists for "strokes" so we
 * emit "spm" suffix verbatim — that's the term used in the rowing world.
 */
export function formatStrokeRate(
  spm: number,
  prefs: Pick<ResolvedFormatPrefs, "locale">,
): string {
  if (!Number.isFinite(spm)) {
    return "—";
  }
  return (
    new Intl.NumberFormat(prefs.locale, {
      maximumFractionDigits: 1,
    }).format(spm) + " spm"
  );
}
