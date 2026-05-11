/**
 * Supported app languages.
 *
 * The `code` is the BCP-47 tag we use as the i18next language and as the
 * folder name under `locales/`. `englishName` is for diagnostics; `nativeName`
 * is what we show in the language picker so users see their own language in
 * its own script ("Deutsch", not "German").
 *
 * Translations are added incrementally — the only locale that ships text in
 * v1 is `en`. Other folders exist as `.gitkeep` placeholders so adding a
 * language is a single JSON drop.
 */

export type SupportedLanguage = {
  code: SupportedLanguageCode;
  englishName: string;
  nativeName: string;
  /** True if the script reads right-to-left. Drives `I18nManager.forceRTL`. */
  rtl: boolean;
};

export type SupportedLanguageCode =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "ja"
  | "zh-Hans"
  | "ar";

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: "en", englishName: "English", nativeName: "English", rtl: false },
  { code: "es", englishName: "Spanish", nativeName: "Español", rtl: false },
  { code: "fr", englishName: "French", nativeName: "Français", rtl: false },
  { code: "de", englishName: "German", nativeName: "Deutsch", rtl: false },
  { code: "it", englishName: "Italian", nativeName: "Italiano", rtl: false },
  { code: "ja", englishName: "Japanese", nativeName: "日本語", rtl: false },
  {
    code: "zh-Hans",
    englishName: "Chinese (Simplified)",
    nativeName: "简体中文",
    rtl: false,
  },
  { code: "ar", englishName: "Arabic", nativeName: "العربية", rtl: true },
] as const;

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "en";

/**
 * Regional language variants we ship targeted overrides for.
 *
 * These are NOT user-selectable in the picker — `SupportedLanguageCode` is
 * what the picker exposes, and a user who wants UK English just keeps
 * "Follow system" with an en-GB OS locale. Each entry must have a base
 * language already in `SUPPORTED_LANGUAGES` so that i18next's per-language
 * fallback chain (configured in `lib/i18n/index.ts`) can resolve missing
 * keys against the base catalog.
 *
 * The convention is: `locales/en/` is the canonical en-US catalog, and
 * `locales/en-GB/` (and any future regional folder) only contains the keys
 * whose phrasing or spelling differs from the base.
 */
export const REGIONAL_LANGUAGE_VARIANTS = ["en-GB"] as const;

export type RegionalLanguageVariant =
  (typeof REGIONAL_LANGUAGE_VARIANTS)[number];

/**
 * A language tag i18next can resolve at runtime: any picker-visible
 * language plus regional override variants. The picker always operates on
 * the narrower `SupportedLanguageCode`; the wider `ResolvedLanguageCode`
 * is what `resolveI18nLanguage` returns and what we hand to
 * `i18next.changeLanguage`.
 */
export type ResolvedLanguageCode =
  | SupportedLanguageCode
  | RegionalLanguageVariant;

const SUPPORTED_CODE_SET = new Set<SupportedLanguageCode>(
  SUPPORTED_LANGUAGES.map((l) => l.code),
);

const REGIONAL_VARIANT_SET = new Set<RegionalLanguageVariant>(
  REGIONAL_LANGUAGE_VARIANTS,
);

export function isSupportedLanguage(
  code: string | null | undefined,
): code is SupportedLanguageCode {
  return code != null && SUPPORTED_CODE_SET.has(code as SupportedLanguageCode);
}

export function isRegionalLanguageVariant(
  code: string | null | undefined,
): code is RegionalLanguageVariant {
  return (
    code != null && REGIONAL_VARIANT_SET.has(code as RegionalLanguageVariant)
  );
}

export function findLanguage(code: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function isRtlLanguage(code: string): boolean {
  return findLanguage(code)?.rtl ?? false;
}
