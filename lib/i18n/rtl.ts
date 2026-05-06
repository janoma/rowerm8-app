import { I18nManager, NativeModules, Platform } from "react-native";

import { isRtlLanguage, type SupportedLanguageCode } from "./languages";

/**
 * Apply RTL settings for the given language. Returns `true` if a JS reload
 * is required for the change to take visual effect.
 *
 * `I18nManager.forceRTL()` only takes effect after the JS bundle reloads —
 * existing views keep their original layout direction until then. Callers
 * (typically the language picker) should compare the previous language with
 * the new one via `isReloadRequiredForLanguage` and prompt the user before
 * reloading.
 */
export function applyRtlForLanguage(code: SupportedLanguageCode): boolean {
  const wantRtl = isRtlLanguage(code);
  // Allow RTL once at process start so that on first launch into an RTL
  // language the layout is already mirrored. This is a no-op if already
  // allowed, and is required by RN before forceRTL takes effect.
  I18nManager.allowRTL(wantRtl);

  const willChange = I18nManager.isRTL !== wantRtl;
  if (willChange) {
    I18nManager.forceRTL(wantRtl);
  }
  return willChange;
}

/**
 * True if switching from `prev` to `next` flips text direction. The picker
 * uses this to decide whether to show the "Restart required" prompt.
 */
export function isReloadRequiredForLanguage(
  prev: SupportedLanguageCode,
  next: SupportedLanguageCode,
): boolean {
  return isRtlLanguage(prev) !== isRtlLanguage(next);
}

/**
 * Best-effort JS reload. Uses `expo-updates` `reloadAsync` when present (the
 * production-safe path), otherwise falls back to RN's DevSettings reload in
 * dev. On platforms where neither is available the caller should ask the
 * user to relaunch manually.
 */
export async function reloadApp(): Promise<boolean> {
  // Try expo-updates first. We require it dynamically so platforms or builds
  // where it isn't linked still load the rest of this module.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require("expo-updates") as typeof import("expo-updates");
    if (typeof Updates.reloadAsync === "function") {
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    // not available; fall through
  }

  if (__DEV__ && Platform.OS !== "web") {
    const dev = (NativeModules as { DevSettings?: { reload?: () => void } })
      .DevSettings;
    if (dev?.reload) {
      dev.reload();
      return true;
    }
  }
  return false;
}
