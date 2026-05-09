/**
 * Pure logic for the theme preference: validation, scheme resolution,
 * and AsyncStorage-shaped load/save helpers.
 *
 * Extracted from `theme-context.tsx` so the persistence + resolution
 * rules are testable in plain Node (the project's Jest config is
 * `testEnvironment: "node"` and avoids dragging React Native through
 * the unit-test path). The runtime provider just composes these
 * helpers with React state and the real `AsyncStorage`.
 */

import { type ColorScheme } from "../tokens";

export type ThemePref = "auto" | "light" | "dark";

const VALID_PREFS: ReadonlySet<ThemePref> = new Set(["auto", "light", "dark"]);

/**
 * Type guard for `ThemePref`. Treats anything that isn't one of the
 * three known strings as invalid (so a corrupted AsyncStorage payload
 * harmlessly falls back to `"auto"`).
 */
export function isThemePref(value: unknown): value is ThemePref {
  return typeof value === "string" && VALID_PREFS.has(value as ThemePref);
}

/**
 * Map the user preference + the OS scheme to the concrete scheme that
 * actually drives token selection. `"auto"` follows the system; the
 * other prefs pin a scheme regardless of the OS. A null `systemScheme`
 * (no preference reported by RN) falls back to light.
 */
export function resolveScheme(
  pref: ThemePref,
  systemScheme: ColorScheme | null | undefined,
): ColorScheme {
  if (pref === "auto") {
    return systemScheme ?? "light";
  }
  return pref;
}

/**
 * Minimal storage interface — both `AsyncStorage` and an in-memory
 * test double satisfy it. Keeping it structural means the provider
 * can stay coupled to `@react-native-async-storage/async-storage`
 * without leaking that dependency into the unit tests.
 */
export type ThemePrefStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

/**
 * Read the persisted preference. Invalid / missing payloads resolve
 * to `"auto"` so callers always get a usable value. Storage failures
 * are silently swallowed for the same reason — appearance is a
 * cosmetic preference and it's better to render with the OS default
 * than to crash the app shell.
 */
export async function loadThemePref(
  storage: ThemePrefStorage,
  key: string,
): Promise<ThemePref> {
  try {
    const raw = await storage.getItem(key);
    return isThemePref(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Persist the preference. Failures are swallowed so a write error
 * doesn't propagate into a UI exception — the user can still pick a
 * theme during the session, it just won't survive a relaunch.
 */
export async function saveThemePref(
  storage: ThemePrefStorage,
  key: string,
  pref: ThemePref,
): Promise<void> {
  try {
    await storage.setItem(key, pref);
  } catch {
    // best-effort persistence
  }
}
