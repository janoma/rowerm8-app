export const PLACEMENT_DONT_SHOW_KEY = "rowerm8.sensorPlacement.dontShowAgain";

export const LOCALE_PREFS_KEY = "rowerm8.locale.prefs.v1";

/**
 * Persisted user profile — body metrics + heart rate thresholds used to
 * personalise zone boundaries and (in a follow-up commit) calorie
 * estimation. All fields are optional; missing values resolve to
 * documented defaults (see `contexts/profile-context.tsx`).
 */
export const PROFILE_PREFS_KEY = "rowerm8.profile.prefs.v1";

/**
 * Persisted appearance preference: `"auto" | "light" | "dark"`.
 * `"auto"` follows the OS color scheme; the other two pin a fixed scheme
 * regardless of system settings. See `lib/design-system/provider`.
 */
export const THEME_PREF_KEY = "rowerm8.theme.pref.v1";

/**
 * Set to `"true"` once the user has dismissed the first-install features
 * carousel. We never replay the carousel after that — only the login block
 * is re-shown on subsequent cold starts (until the user signs in).
 */
export const ONBOARDING_FEATURES_SEEN_KEY =
  "rowerm8.onboarding.featuresSeen.v1";

/**
 * Reserved for the future signed-in session token. We will store it in
 * `expo-secure-store` (keychain / keystore) instead of `AsyncStorage` once
 * real authentication is wired up; the constant lives here so both call
 * sites use the same key.
 */
export const AUTH_SESSION_KEY = "rowerm8.auth.session.v1";

/**
 * When set to `"true"`, the Free-row "Auto-starting activity…" modal is
 * suppressed and the user has to tap Start manually. Stored in the
 * "disabled" form so that a missing key (the default) means auto-start
 * is enabled — same convention as `ONBOARDING_FEATURES_SEEN_KEY` and
 * `PLACEMENT_DONT_SHOW_KEY`.
 */
export const AUTO_START_DISABLED_KEY = "rowerm8.freeRow.autoStartDisabled.v1";
