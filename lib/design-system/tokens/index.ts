/**
 * Token bundle entry-point for the in-app design system.
 *
 * The pure-data tokens (colors, hr-zones, achievements, chart,
 * spacing, radius, motion, typography) live in the workspace package
 * `@rowerm8/design-tokens` so they're shareable with a future
 * Next.js website. This barrel re-exports them and adds the one
 * native-only token group (`elevation`) that depends on
 * `Platform.select` and therefore must stay app-side.
 *
 * Importing from `@/lib/design-system/tokens` (or any sibling shim
 * like `./colors`, `./hr-zones`, …) is intentionally cheap and
 * side-effect-free.
 */

import {
  darkTokens as darkBaseTokens,
  lightTokens as lightBaseTokens,
  type ColorScheme,
  type ThemeTokens as BaseThemeTokens,
} from "@rowerm8/design-tokens";

export type ThemeTokens = BaseThemeTokens;

export const lightTokens: ThemeTokens = lightBaseTokens;
export const darkTokens: ThemeTokens = darkBaseTokens;

export type { ColorScheme };

export const tokensForScheme = (scheme: ColorScheme): ThemeTokens =>
  scheme === "dark" ? darkTokens : lightTokens;

export {
  HR_ZONE_KEYS,
  achievementsDark,
  achievementsLight,
  buildChartTokens,
  darkColors,
  fontsAndroid,
  fontsIos,
  fontsWeb,
  hrZonesDark,
  hrZonesLight,
  lightColors,
  motion,
  radius,
  spacing,
  text,
} from "@rowerm8/design-tokens";

export type {
  AchievementKey,
  AchievementPalette,
  AchievementTokens,
  ChartTokens,
  ColorTokens,
  DurationToken,
  EasingToken,
  FontFamilies,
  HrZoneKey,
  HrZonePalette,
  HrZoneTokens,
  MotionTokens,
  RadiusScale,
  RadiusToken,
  SpacingScale,
  SpacingToken,
  TextStyleKey,
  TextStyleToken,
  TypographyTokens,
} from "@rowerm8/design-tokens";
