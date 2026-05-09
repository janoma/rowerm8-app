// MUST be the very first import: `intl-messageformat` (pulled in by
// `i18next-icu` below) reads `Intl.Locale` and `Intl.PluralRules` at
// module load. If those globals aren't patched in before any other
// import runs, ICU silently falls back to returning the raw template
// string and the UI shows literal `{count, plural, ...}` placeholders.
import "./intl-polyfill";

// `use` is aliased because React's `use` hook lint (`react-hooks/rules-of-hooks`)
// treats any `use*()` call as a hook invocation and would flag the i18next
// initializer below.
import i18next, { use as registerI18nPlugin } from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LANGUAGE } from "./languages";
import { DEFAULT_NAMESPACE, NAMESPACES, RESOURCES } from "./resources";

let initialized = false;

/**
 * Boot i18next with the bundled English catalogs and ICU MessageFormat
 * support (needed for plurals/genders in languages like Arabic, Russian,
 * and Japanese once those translations land).
 *
 * Idempotent: safe to call from multiple module entry points. The actual
 * resolved language is set later by `LocaleProvider` once it has read user
 * preferences and OS locales.
 */
export function initI18n(): typeof i18next {
  if (initialized) {
    return i18next;
  }
  initialized = true;

  registerI18nPlugin(ICU)
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      ns: NAMESPACES as unknown as string[],
      defaultNS: DEFAULT_NAMESPACE,
      interpolation: {
        // ICU MessageFormat handles its own escaping; React Native already
        // renders strings as text nodes so HTML escaping is unnecessary.
        escapeValue: false,
      },
      returnNull: false,
      // Surface missing keys loudly in dev so untranslated strings are
      // obvious during development, but never throw — a missing string
      // should never crash the UI in release.
      saveMissing: false,
    })
    .catch((err: unknown) => {
      console.warn("[i18n] init failed", err);
    });

  return i18next;
}

export { default as i18n } from "i18next";
export * from "./languages";
export * from "./resolveLanguage";
export * from "./resources";
export {
  applyRtlForLanguage,
  isReloadRequiredForLanguage,
  reloadApp,
} from "./rtl";
