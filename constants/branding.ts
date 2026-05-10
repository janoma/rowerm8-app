/**
 * Canonical product wordmark.
 *
 * The brand stays in Latin script across every locale (matching how
 * Slack, Stripe, Spotify, etc. ship their wordmarks worldwide), so this
 * is the single source of truth for any user-facing surface that names
 * the app. Reference it directly in JSX, or pass it into i18next as the
 * `{appName}` ICU placeholder so translators cannot accidentally
 * transliterate or rewrite the brand.
 *
 * Note: build-time config strings in `app.json` (e.g. iOS permission
 * descriptions, Expo `name`) duplicate this value because they cannot
 * import TypeScript at build time. If those drift, switch `app.json` to
 * `app.config.ts` and re-export from here.
 */
export const APP_NAME = "RowerM8" as const;
