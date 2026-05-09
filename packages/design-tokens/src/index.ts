/**
 * @rowerm8/design-tokens — public entry point.
 *
 * Composes the per-concern token modules into two flat `lightTokens`
 * and `darkTokens` objects. Both the in-app `ThemeProvider` (via
 * `lib/design-system/tokens`) and a future Next.js website import
 * from this entry point — no React Native is reachable from any file
 * in this package, enforced by ESLint.
 */

import {
  achievementsDark,
  achievementsLight,
  type AchievementPalette,
} from "./achievements";
import { buildChartTokens, type ChartTokens } from "./chart";
import { darkColors, lightColors, type ColorTokens } from "./colors";
import {
  hrZonesDark,
  hrZonesLight,
  HR_ZONE_KEYS,
  type HrZonePalette,
} from "./hr-zones";
import { motion, type MotionTokens } from "./motion";
import { radius, type RadiusScale } from "./radius";
import { spacing, type SpacingScale } from "./spacing";
import { text } from "./typography";

export type ColorScheme = "light" | "dark";

export type ThemeTokens = {
  colors: ColorTokens;
  hrZones: HrZonePalette;
  achievements: AchievementPalette;
  chart: ChartTokens;
  spacing: SpacingScale;
  radius: RadiusScale;
  motion: MotionTokens;
  text: typeof text;
};

export const lightTokens: ThemeTokens = {
  colors: lightColors,
  hrZones: hrZonesLight,
  achievements: achievementsLight,
  chart: buildChartTokens(lightColors, hrZonesLight),
  spacing,
  radius,
  motion,
  text,
};

export const darkTokens: ThemeTokens = {
  colors: darkColors,
  hrZones: hrZonesDark,
  achievements: achievementsDark,
  chart: buildChartTokens(darkColors, hrZonesDark),
  spacing,
  radius,
  motion,
  text,
};

export const tokensForScheme = (scheme: ColorScheme): ThemeTokens =>
  scheme === "dark" ? darkTokens : lightTokens;

export {
  HR_ZONE_KEYS,
  achievementsDark,
  achievementsLight,
  buildChartTokens,
  darkColors,
  hrZonesDark,
  hrZonesLight,
  lightColors,
  motion,
  radius,
  spacing,
  text,
};

export type {
  AchievementKey,
  AchievementPalette,
  AchievementTokens,
} from "./achievements";
export type { ChartTokens } from "./chart";
export type { ColorTokens } from "./colors";
export type { HrZoneKey, HrZonePalette, HrZoneTokens } from "./hr-zones";
export type { DurationToken, EasingToken, MotionTokens } from "./motion";
export type { RadiusScale, RadiusToken } from "./radius";
export type { SpacingScale, SpacingToken } from "./spacing";
export type {
  FontFamilies,
  TextStyleKey,
  TextStyleToken,
  TypographyTokens,
} from "./typography";

export { fontsAndroid, fontsIos, fontsWeb, typography } from "./typography";
