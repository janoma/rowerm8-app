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

const SUPPORTED_CODE_SET = new Set<SupportedLanguageCode>(
  SUPPORTED_LANGUAGES.map((l) => l.code),
);

export function isSupportedLanguage(
  code: string | null | undefined,
): code is SupportedLanguageCode {
  return code != null && SUPPORTED_CODE_SET.has(code as SupportedLanguageCode);
}

export function findLanguage(code: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function isRtlLanguage(code: string): boolean {
  return findLanguage(code)?.rtl ?? false;
}
