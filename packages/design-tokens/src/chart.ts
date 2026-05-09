/**
 * Chart / sparkline color tokens.
 *
 * Deliberately *aliases* other tokens so that visual semantics stay
 * coherent across live and recorded views:
 *
 *   chart.cadence = colors.accent      (the brand teal)
 *   chart.heart   = hrZones.z5.bg      (the saturated red)
 *   chart.track   = a faint accent wash for empty-data rails
 *
 * If you ever want to change the brand teal or the Z5 red, this file
 * does not need to change — the aliases follow automatically.
 */

import type { ColorTokens } from "./colors";
import type { HrZonePalette } from "./hr-zones";

export type ChartTokens = {
  cadence: string;
  heart: string;
  /** Low-emphasis baseline rail color. */
  track: string;
};

export function buildChartTokens(
  colors: ColorTokens,
  hrZones: HrZonePalette,
): ChartTokens {
  return {
    cadence: colors.accent,
    heart: hrZones.z5.bg,
    // Use the accentSubtle wash; it's already designed to be a faint
    // background tint that disappears against the surface.
    track: colors.accentSubtle,
  };
}
