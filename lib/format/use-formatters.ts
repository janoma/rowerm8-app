import { useMemo } from "react";

import { useLocale } from "@/contexts/locale-context";

import { formatDate, formatDateTime, formatTimeOfDay } from "./date";
import { formatDistance } from "./distance";
import { formatEnergy } from "./energy";
import { formatPace } from "./pace";
import { formatPower, formatStrokeRate } from "./power";
import { formatTemperature } from "./temperature";
import { formatDuration } from "./time";
import type { ResolvedFormatPrefs } from "./types";
import { formatWeight } from "./weight";

/**
 * React-side glue: read the resolved locale prefs from `LocaleProvider` and
 * close over them so component code reads as `formatters.distance(meters)`
 * with no per-call boilerplate.
 *
 * Returned object identity is stable as long as the resolved prefs are
 * unchanged, so it's safe to pass into memoized children.
 */
export function useFormatters() {
  const { resolved } = useLocale();

  return useMemo(() => {
    const prefs: ResolvedFormatPrefs = {
      locale: resolved.locale,
      measurementSystem: resolved.measurementSystem,
      paceUnit: resolved.paceUnit,
      weightUnit: resolved.weightUnit,
      temperatureUnit: resolved.temperatureUnit,
    };

    return {
      prefs,
      distance: (meters: number) => formatDistance(meters, prefs),
      pace: (mps: number) => formatPace(mps, prefs),
      power: (watts: number) => formatPower(watts, prefs),
      strokeRate: (spm: number) => formatStrokeRate(spm, prefs),
      weight: (kg: number) => formatWeight(kg, prefs),
      energy: (joules: number) => formatEnergy(joules, prefs),
      temperature: (c: number) => formatTemperature(c, prefs),
      duration: (seconds: number, opts?: { tenths?: boolean }) =>
        formatDuration(seconds, opts),
      date: (d: Date, options?: Intl.DateTimeFormatOptions) =>
        formatDate(d, prefs, options),
      time: (d: Date, options?: Intl.DateTimeFormatOptions) =>
        formatTimeOfDay(d, prefs, options),
      dateTime: (d: Date) => formatDateTime(d, prefs),
    };
  }, [resolved]);
}
