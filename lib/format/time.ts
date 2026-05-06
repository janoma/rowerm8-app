/**
 * Format a positive duration in seconds as `H:MM:SS`, `M:SS`, or `M:SS.t`.
 *
 * Splits and pace are short enough that the cleanest reading is a fixed
 * `M:SS.t` (one decimal) regardless of locale; longer workout durations
 * read better as `H:MM:SS`. Negative or non-finite inputs return the
 * conventional em-dash placeholder.
 *
 * NOTE: This is *not* localized via `Intl.DateTimeFormat` because we want a
 * stable monospace-friendly layout; date/clock values use `formatDate`.
 */
export function formatDuration(
  seconds: number,
  options: { tenths?: boolean } = {},
): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }

  const showTenths = options.tenths === true;
  const totalTenths = Math.round(seconds * 10);
  const hh = Math.floor(totalTenths / 36000);
  const mm = Math.floor((totalTenths % 36000) / 600);
  const ss = Math.floor((totalTenths % 600) / 10);
  const t = totalTenths % 10;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hh > 0) {
    return `${hh}:${pad(mm)}:${pad(ss)}${showTenths ? `.${t}` : ""}`;
  }
  return `${mm}:${pad(ss)}${showTenths ? `.${t}` : ""}`;
}

/**
 * Format pace as the user wants to see it. `seconds` is the SI duration to
 * cover the chosen unit (one 500m, one km, one mile). Output is `M:SS.t /
 * UNIT` where the unit suffix is localized via `Intl.NumberFormat`'s unit
 * style for `meter`/`kilometer`/`mile`.
 */
export function formatPaceFromSeconds(
  seconds: number,
  unitSuffix: string,
): string {
  return `${formatDuration(seconds, { tenths: true })} / ${unitSuffix}`;
}
