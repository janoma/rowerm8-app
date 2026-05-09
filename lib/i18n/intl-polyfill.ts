/**
 * Conditional Intl polyfills for the React Native runtime.
 *
 * Why this file exists:
 *   `intl-messageformat` (used by `i18next-icu`) calls `Intl.PluralRules`
 *   and `Intl.Locale` at format time. When either is missing or
 *   incomplete it throws a `MISSING_INTL_API` error which `i18next-icu`
 *   silently swallows — its default `parseErrorHandler` returns the raw
 *   template, so users see strings like
 *   `{count, plural, one {# stroke} other {# strokes}}` on screen.
 *
 *   Hermes' Intl support is uneven (especially for `Intl.Locale`), so
 *   the only reliable fix is to ship the FormatJS polyfills and load
 *   them before the i18next pipeline runs.
 *
 *   The non-`-force` polyfill entrypoints are intentional: they only
 *   patch in if the native implementation is missing/incomplete, so
 *   modern JSC (iOS) keeps using the platform's faster, smaller,
 *   ICU-backed implementation when it's available.
 *
 * Locale-data note:
 *   `Intl.PluralRules` requires per-locale CLDR data; we eagerly import
 *   the data for every language we ship a translation for. The bundle
 *   cost is small (~2–3 KB per locale) and it lets us avoid an async
 *   load step on first render.
 */

// The `.js` suffix is required: each FormatJS polyfill exposes its
// polyfill entry under the `./polyfill.js` conditional export, not
// `./polyfill`. Same for the per-locale data files.
import "@formatjs/intl-getcanonicallocales/polyfill.js";
import "@formatjs/intl-locale/polyfill.js";
import "@formatjs/intl-pluralrules/polyfill.js";

// Plural rule data, one import per shipped language. The `zh-Hans` tag
// resolves to the script-neutral `zh` data set (Chinese only has the
// `other` plural category, so the script subtag doesn't change rules).
import "@formatjs/intl-pluralrules/locale-data/ar.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
import "@formatjs/intl-pluralrules/locale-data/fr.js";
import "@formatjs/intl-pluralrules/locale-data/it.js";
import "@formatjs/intl-pluralrules/locale-data/ja.js";
import "@formatjs/intl-pluralrules/locale-data/zh.js";
