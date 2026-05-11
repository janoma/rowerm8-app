/**
 * Compile-time feature flags for code paths kept in the codebase but
 * gated off the user-facing UI.
 *
 * Flags are plain `const` exports — flipping one requires editing this
 * file and rebuilding (no runtime override / Settings switch). Each
 * flag carries a comment explaining what flips on/off, why it's
 * currently in its default state, and what files participate in the
 * gate so a future re-enable doesn't have to re-discover them.
 */

/**
 * Selectable HR-zone display model (5-zone Garmin/Polar vs 7-zone
 * Coggan/Friel).
 *
 * When `false` (current default), the app behaves as if only the
 * 5-zone Garmin/Polar ramp exists:
 *
 *   - `Settings → Profile` hides the "Heart rate zones" section and
 *     the "Threshold heart rate" row.
 *   - `useHrZoneResolver` always returns the `garminPolar5` variant,
 *     regardless of any persisted `hrZoneModel` value (the persisted
 *     selection is left on disk so flipping the flag back on
 *     restores the previous choice).
 *   - `<ZoneBar>` / `<ZonePill>` / `RowMetricsCard` are unchanged —
 *     they keep their `cogganFriel7` branches because the resolver
 *     never asks for them in this mode.
 *
 * Background: a usability check in May 2026 surfaced that users
 * coming from Strava / Zwift / Garmin Connect (which all default to
 * %-of-max 5-zone ramps) misread the wider Coggan "Recovery" zone as
 * the bar being broken. For a rowing-first app, the 5-zone ramp also
 * lines up better with British Rowing / USRowing / Concept2
 * conventions, so we only need a single, well-known model.
 *
 * To re-enable:
 *
 *   1. Set this flag to `true`.
 *   2. (Optional) Restore a Coggan-aware footer string for
 *      `profile.section.heartRateFooter` in `locales/en/settings.json`
 *      (the current copy intentionally only mentions max HR).
 *   3. Rebuild the app (`pnpm ios` / `pnpm android` / EAS build) so
 *      Babel re-evaluates the constant.
 *
 * The math (`cogganZoneRanges`, `cogganZoneForBpm` in
 * `lib/hr/zones.ts`), the design tokens (`cogganZones*` in
 * `packages/design-tokens/src/hr-zones.ts`), the design-system
 * primitives (`<ZoneBar>` / `<ZonePill>` Coggan branches), the
 * `hrZoneModel` profile field, and the locale strings under
 * `profile.fields.hrZoneModel.*` / `profile.fields.thresholdHrBpm.*`
 * / `profile.section.zoneModel*` are all intentionally preserved
 * here so the flip is the small change above and nothing more.
 */
export const ENABLE_COGGAN_HR_ZONE_MODEL = false;
