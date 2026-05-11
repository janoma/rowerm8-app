import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocales } from "expo-localization";
import i18next, { changeLanguage } from "i18next";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { LOCALE_PREFS_KEY } from "@/constants/storage-keys";
import {
  applyRtlForLanguage,
  DEFAULT_LANGUAGE,
  initI18n,
  type LocaleHint,
  type ResolvedLanguageCode,
  resolveI18nLanguage,
  resolveLanguage,
  type SupportedLanguageCode,
} from "@/lib/i18n";
import type {
  MeasurementSystem,
  PaceUnit,
  TemperatureUnit,
  WeightUnit,
} from "@/lib/units";

initI18n();

export type LocalePrefs = {
  language: "auto" | SupportedLanguageCode;
  measurementSystem: "auto" | MeasurementSystem;
  /**
   * Rowing pace has no `"auto"` option: pace is independent of the
   * measurement system (Concept2 / World Rowing convention is per-500m
   * regardless), so a follow-the-system value would be misleading. The
   * default is `"per500m"` and users explicitly switch to per-km / per-mile.
   */
  paceUnit: PaceUnit;
  weightUnit: "auto" | WeightUnit;
  temperatureUnit: "auto" | TemperatureUnit;
};

export type ResolvedLocale = {
  /** BCP-47 tag, e.g. `"en-US"`. Suitable for `Intl.*` constructors. */
  locale: string;
  /**
   * Picker-facing language. Always one of `SupportedLanguageCode` — never a
   * regional variant — so existing UI (settings rows, RTL detection, picker
   * highlighting) stays simple. Use `i18nLanguage` for anything that talks
   * to i18next directly.
   */
  language: SupportedLanguageCode;
  /**
   * Active i18next language tag. May be a regional override variant like
   * `en-GB` when `prefs.language === "auto"` and the OS reports a matching
   * locale; missing keys fall back through `fallbackLng` to the base
   * language catalog.
   */
  i18nLanguage: ResolvedLanguageCode;
  measurementSystem: MeasurementSystem;
  paceUnit: PaceUnit;
  weightUnit: WeightUnit;
  temperatureUnit: TemperatureUnit;
  /** True if the resolved language is right-to-left. */
  isRtl: boolean;
  /**
   * What each axis would resolve to right now if the corresponding
   * preference were `"auto"` (i.e. the value derived purely from the OS,
   * independent of the user's overrides). Used by option pickers to render
   * labels like "Follow system (metric)" so users can preview what the
   * default would be before committing to it.
   */
  auto: {
    language: SupportedLanguageCode;
    measurementSystem: MeasurementSystem;
    weightUnit: WeightUnit;
    temperatureUnit: TemperatureUnit;
  };
};

export type LocaleContextValue = {
  prefs: LocalePrefs;
  resolved: ResolvedLocale;
  isHydrated: boolean;
  setPref: <K extends keyof LocalePrefs>(key: K, value: LocalePrefs[K]) => void;
  resetPrefs: () => void;
};

const DEFAULT_PREFS: LocalePrefs = {
  language: "auto",
  measurementSystem: "auto",
  paceUnit: "per500m",
  weightUnit: "auto",
  temperatureUnit: "auto",
};

const VALID_PACE_UNITS: ReadonlySet<PaceUnit> = new Set([
  "per500m",
  "perKm",
  "perMile",
]);

/**
 * Coerce a (possibly legacy) persisted prefs payload to the current shape.
 * Earlier builds stored `paceUnit: "auto"`; map any unknown value back to
 * the rowing default so a stored prefs blob from before the schema change
 * doesn't leave the UI in an unselectable state.
 */
function migratePrefs(parsed: Partial<LocalePrefs>): Partial<LocalePrefs> {
  if (
    parsed.paceUnit !== undefined &&
    !VALID_PACE_UNITS.has(parsed.paceUnit as PaceUnit)
  ) {
    return { ...parsed, paceUnit: "per500m" };
  }
  return parsed;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<LocalePrefs>(DEFAULT_PREFS);
  const [isHydrated, setIsHydrated] = useState(false);
  // useLocales re-renders when the device locale changes (e.g. iOS per-app
  // language). The first entry is the user's primary preference.
  const osLocales = useLocales();

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LOCALE_PREFS_KEY)
      .then((raw) => {
        if (cancelled || !raw) {
          return;
        }
        try {
          const parsed = migratePrefs(JSON.parse(raw) as Partial<LocalePrefs>);
          setPrefs((prev) => ({ ...prev, ...parsed }));
        } catch {
          // Corrupted entry — fall back to defaults.
        }
      })
      .catch(() => {
        // AsyncStorage failure is non-fatal; defaults are usable.
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useMemo<ResolvedLocale>(
    () => resolvePrefs(prefs, osLocales),
    [prefs, osLocales],
  );

  // Drive i18next + RTL from the resolved language. We track the last RTL
  // state we applied so we don't re-call forceRTL on every render — it
  // would be a no-op functionally but it spams a native warning on Android.
  // i18next runs on `i18nLanguage` (which may be a regional variant like
  // `en-GB`); RTL only depends on the base picker language since regional
  // overrides we ship are all LTR.
  const lastRtlAppliedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (i18next.language !== resolved.i18nLanguage) {
      changeLanguage(resolved.i18nLanguage).catch((err) => {
        console.warn("[locale] changeLanguage failed", err);
      });
    }
    if (lastRtlAppliedRef.current !== resolved.isRtl) {
      // Note: a JS reload is required for forceRTL to actually flip the
      // existing view tree. The picker handles that prompt; here we just
      // make sure subsequent mounts see the right value.
      applyRtlForLanguage(resolved.language);
      lastRtlAppliedRef.current = resolved.isRtl;
    }
  }, [resolved.i18nLanguage, resolved.language, resolved.isRtl]);

  const setPref = useCallback(
    <K extends keyof LocalePrefs>(key: K, value: LocalePrefs[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(LOCALE_PREFS_KEY, JSON.stringify(next)).catch(
          () => {
            // Best-effort persistence; in-memory state still updates.
          },
        );
        return next;
      });
    },
    [],
  );

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    AsyncStorage.removeItem(LOCALE_PREFS_KEY).catch(() => {});
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ prefs, resolved, isHydrated, setPref, resetPrefs }),
    [prefs, resolved, isHydrated, setPref, resetPrefs],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}

// --- Resolution -----------------------------------------------------------

type OsLocale = ReturnType<typeof useLocales>[number];

function resolvePrefs(
  prefs: LocalePrefs,
  osLocales: readonly OsLocale[] | null | undefined,
): ResolvedLocale {
  const hints: LocaleHint[] = (osLocales ?? []).map((l) => ({
    languageTag: l.languageTag ?? null,
    languageCode: l.languageCode ?? null,
    languageScriptCode: l.languageScriptCode ?? null,
  }));
  const primary = osLocales?.[0] ?? null;

  // First, compute what each axis would default to from the OS, ignoring
  // user overrides. The `auto` block on the resolved locale exposes these
  // so pickers can render "Follow system (X)" labels.
  const autoLanguage = resolveLanguage("auto", hints);
  const autoMeasurementSystem = resolveMeasurementSystem(primary);
  const autoWeightUnit: WeightUnit =
    autoMeasurementSystem === "metric" ? "kg" : "lb";
  const autoTemperatureUnit = resolveTemperatureUnit(
    primary,
    autoMeasurementSystem,
  );

  // Now apply user overrides on top.
  const language =
    prefs.language === "auto"
      ? autoLanguage
      : resolveLanguage(prefs.language, hints);

  // i18next runs on a tag that may include regional overrides (e.g.
  // `en-GB`). Auto-mode promotes the OS regional tag when we ship overrides
  // for it; explicit picker selections always resolve to the base language.
  const i18nLanguage = resolveI18nLanguage(prefs.language, hints);

  const measurementSystem =
    prefs.measurementSystem === "auto"
      ? autoMeasurementSystem
      : prefs.measurementSystem;

  const weightUnit =
    prefs.weightUnit === "auto"
      ? measurementSystem === "metric"
        ? "kg"
        : "lb"
      : prefs.weightUnit;

  const temperatureUnit =
    prefs.temperatureUnit === "auto"
      ? resolveTemperatureUnit(primary, measurementSystem)
      : prefs.temperatureUnit;

  // Pace is decoupled from the measurement system on purpose (see the
  // `LocalePrefs.paceUnit` doc): pass the stored value straight through.
  const paceUnit = prefs.paceUnit;

  // Compose a BCP-47 tag with a region when the OS gave us one, so number
  // formatting matches the user's region (e.g. en-GB shows "1,234.5" but
  // de-DE shows "1.234,5"). Falls back to the bare language code.
  const region =
    primary?.regionCode && /^[A-Z]{2}$/.test(primary.regionCode)
      ? primary.regionCode
      : null;
  const locale = region ? `${language}-${region}` : language;

  return {
    locale,
    language,
    i18nLanguage,
    measurementSystem,
    paceUnit,
    weightUnit,
    temperatureUnit,
    isRtl: language === "ar",
    auto: {
      language: autoLanguage,
      measurementSystem: autoMeasurementSystem,
      weightUnit: autoWeightUnit,
      temperatureUnit: autoTemperatureUnit,
    },
  };
}

function resolveMeasurementSystem(locale: OsLocale | null): MeasurementSystem {
  // expo-localization's `measurementSystem` returns "metric" | "us" | "uk" | null.
  // We currently only model two display systems; map UK to metric since that's
  // the better default for distance-based metrics in rowing/running.
  const ms = locale?.measurementSystem;
  if (ms === "us") {
    return "imperialUS";
  }
  return "metric";
}

function resolveTemperatureUnit(
  locale: OsLocale | null,
  fallback: MeasurementSystem,
): TemperatureUnit {
  const t = locale?.temperatureUnit;
  if (t === "fahrenheit") {
    return "F";
  }
  if (t === "celsius") {
    return "C";
  }
  return fallback === "imperialUS" ? "F" : "C";
}

// Re-export for downstream consumers that just need defaults (e.g. tests).
export { DEFAULT_LANGUAGE, DEFAULT_PREFS };
