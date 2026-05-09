/**
 * Runtime theme provider.
 *
 * Owns three pieces of state:
 *
 *   1. `prefScheme` — the user's persisted appearance preference,
 *      one of `"auto" | "light" | "dark"`. Persisted to AsyncStorage
 *      under `THEME_PREF_KEY` (mirrors how `LocaleProvider` stores
 *      locale prefs in `LOCALE_PREFS_KEY`).
 *   2. `scheme` — the resolved scheme actually used to pick tokens.
 *      `pref === "auto"` ? `useColorScheme() ?? "light"` : `pref`.
 *   3. `tokens` / `fonts` — the design-system token bundle for the
 *      resolved scheme, plus a platform-resolved font-family map.
 *
 * The exposed `Theme` value is memoized aggressively (keyed only on
 * `scheme`, `prefScheme`, `isHydrated`, and the stable setter) because
 * the React Compiler experiment turns over-eager re-renders into
 * subtle bugs — see `app.json`'s `reactCompiler: true`.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme as useRNColorScheme } from "react-native";

import { THEME_PREF_KEY } from "@/constants/storage-keys";

import { type ColorScheme, type ThemeTokens, tokensForScheme } from "../tokens";
import {
  type FontFamilies,
  fontsAndroid,
  fontsIos,
  fontsWeb,
} from "../tokens/typography";
import {
  loadThemePref,
  resolveScheme,
  saveThemePref,
  type ThemePref,
} from "./theme-pref";

export type { ThemePref };

export type Theme = {
  /** Resolved color scheme actually rendered (`"light"` or `"dark"`). */
  scheme: ColorScheme;
  /** User preference (may be `"auto"`). */
  prefScheme: ThemePref;
  /** Token bundle for the resolved scheme. */
  tokens: ThemeTokens;
  /** Platform-resolved font-family map (system/SF Pro on iOS, etc.). */
  fonts: FontFamilies;
  /**
   * Has the persisted preference loaded yet? Useful for the
   * `<Splash>` / app-shell to avoid a one-frame flash when the user
   * has chosen a non-system scheme but the AsyncStorage read is in
   * flight.
   */
  isHydrated: boolean;
  /** Update the persisted user preference. */
  setPrefScheme: (pref: ThemePref) => void;
};

const ThemeContext = createContext<Theme | null>(null);

const PLATFORM_FONTS: FontFamilies = Platform.select({
  ios: fontsIos,
  android: fontsAndroid,
  default: fontsWeb,
})!;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [prefScheme, setPrefSchemeState] = useState<ThemePref>("auto");
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate the persisted preference. Failures are non-fatal — we just
  // stay on `"auto"` and the OS scheme drives the visual.
  useEffect(() => {
    let cancelled = false;
    loadThemePref(AsyncStorage, THEME_PREF_KEY)
      .then((pref) => {
        if (!cancelled) {
          setPrefSchemeState(pref);
        }
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

  const setPrefScheme = useCallback((pref: ThemePref) => {
    setPrefSchemeState(pref);
    void saveThemePref(AsyncStorage, THEME_PREF_KEY, pref);
  }, []);

  const scheme: ColorScheme = resolveScheme(prefScheme, systemScheme);

  const tokens = useMemo(() => tokensForScheme(scheme), [scheme]);

  const value = useMemo<Theme>(
    () => ({
      scheme,
      prefScheme,
      tokens,
      fonts: PLATFORM_FONTS,
      isHydrated,
      setPrefScheme,
    }),
    [scheme, prefScheme, tokens, isHydrated, setPrefScheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Internal accessor — primitives and screens should import `useTheme`
 * from `@/lib/design-system` (the public re-export) so they don't
 * become coupled to the provider's file path.
 */
export function useThemeContext(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
