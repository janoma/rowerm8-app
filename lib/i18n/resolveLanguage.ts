import {
  DEFAULT_LANGUAGE,
  isRegionalLanguageVariant,
  isSupportedLanguage,
  type ResolvedLanguageCode,
  type SupportedLanguageCode,
} from "./languages";

/**
 * A locale entry as returned by `expo-localization.getLocales()`. We only
 * depend on the BCP-47 tag fields here so this module stays pure and
 * testable without pulling expo-localization into Node.
 */
export type LocaleHint = {
  languageTag?: string | null;
  languageCode?: string | null;
  /**
   * BCP-47 script subtag (e.g. "Hans", "Hant"). Required to disambiguate
   * Chinese, which is the one supported language with multiple scripts.
   */
  languageScriptCode?: string | null;
};

/**
 * Resolve the user's preferred language into one of `SUPPORTED_LANGUAGES`.
 *
 * Resolution order:
 *
 *   1. If `prefLanguage` is anything other than `"auto"`, use it.
 *   2. Walk OS locales in priority order; for each, try the full tag, then
 *      the language+script (for `zh-Hans`/`zh-Hant`), then the language
 *      subtag alone.
 *   3. Fall back to `DEFAULT_LANGUAGE` (`en`).
 *
 * Pure: no expo / React Native imports, so it can be reused on any platform
 * (including the eventual web build) and unit-tested in plain Node.
 */
export function resolveLanguage(
  prefLanguage: SupportedLanguageCode | "auto",
  osLocales: readonly LocaleHint[] | null | undefined,
): SupportedLanguageCode {
  if (prefLanguage !== "auto" && isSupportedLanguage(prefLanguage)) {
    return prefLanguage;
  }

  const locales = osLocales ?? [];
  for (const locale of locales) {
    const candidate = pickFromLocale(locale);
    if (candidate) {
      return candidate;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Like `resolveLanguage`, but additionally surfaces regional override
 * variants we ship (currently `en-GB`). Used to drive i18next's runtime
 * language so users on, e.g., en-GB OS locales pick up UK-spelling
 * overrides automatically — the picker still treats English as a single
 * option.
 *
 * Resolution rules:
 *
 *   - Explicit picker selection (anything other than `"auto"`) bypasses
 *     regional detection and resolves through `resolveLanguage`. Choosing
 *     "English" in the picker means "give me the canonical en catalog",
 *     regardless of OS region.
 *   - In `"auto"` mode we walk OS locales in priority order; if any tag
 *     matches a known regional variant, return it. Otherwise fall through
 *     to the base-language resolution.
 */
export function resolveI18nLanguage(
  prefLanguage: SupportedLanguageCode | "auto",
  osLocales: readonly LocaleHint[] | null | undefined,
): ResolvedLanguageCode {
  if (prefLanguage !== "auto") {
    return resolveLanguage(prefLanguage, osLocales);
  }

  const locales = osLocales ?? [];
  for (const locale of locales) {
    if (isRegionalLanguageVariant(locale.languageTag)) {
      return locale.languageTag;
    }
    const candidate = pickFromLocale(locale);
    if (candidate) {
      return candidate;
    }
  }

  return DEFAULT_LANGUAGE;
}

function pickFromLocale(locale: LocaleHint): SupportedLanguageCode | null {
  const tag = locale.languageTag ?? null;
  const code = locale.languageCode ?? null;
  const script = locale.languageScriptCode ?? null;

  // Special-case Chinese: the device may report `zh`, `zh-CN`, `zh-Hans-CN`,
  // etc. We only ship `zh-Hans` translations, so map any Simplified variant
  // to it and otherwise fall through.
  if (code === "zh" || tag?.toLowerCase().startsWith("zh")) {
    if (script === "Hans" || tag === "zh-CN" || tag === "zh-SG") {
      return "zh-Hans";
    }
    if (
      script === "Hant" ||
      tag === "zh-TW" ||
      tag === "zh-HK" ||
      tag === "zh-MO"
    ) {
      // No `zh-Hant` catalog yet; fall through to default.
      return null;
    }
    // Bare `zh` is most commonly Simplified in practice.
    if (code === "zh") {
      return "zh-Hans";
    }
  }

  if (tag && isSupportedLanguage(tag)) {
    return tag;
  }
  if (code && isSupportedLanguage(code)) {
    return code;
  }
  return null;
}
