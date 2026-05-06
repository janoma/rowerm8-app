import type { ResolvedFormatPrefs } from "./types";

export function formatDate(
  date: Date,
  prefs: Pick<ResolvedFormatPrefs, "locale">,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(prefs.locale, options).format(date);
}

export function formatTimeOfDay(
  date: Date,
  prefs: Pick<ResolvedFormatPrefs, "locale">,
  options: Intl.DateTimeFormatOptions = { timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(prefs.locale, options).format(date);
}

export function formatDateTime(
  date: Date,
  prefs: Pick<ResolvedFormatPrefs, "locale">,
): string {
  return new Intl.DateTimeFormat(prefs.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
