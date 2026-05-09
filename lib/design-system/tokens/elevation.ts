/**
 * Elevation tokens — shadow on iOS, `elevation` on Android, `boxShadow`
 * on web.
 *
 * This is the *one* token file that imports `react-native` (for
 * `Platform`). The `elevation.web.ts` sibling provides a no-RN
 * variant for the future Next.js consumer; Metro will pick the
 * native file via its default extension resolution.
 *
 * The level scale matches Material 3's resting elevations:
 *
 *   level0 — flush, no shadow.
 *   level1 — cards, list rows.
 *   level2 — sticky headers, segmented controls.
 *   level3 — sheets, modal containers.
 */

import { Platform, type ViewStyle } from "react-native";

export type ElevationLevel = "level0" | "level1" | "level2" | "level3";

/** Subset of `ViewStyle` that's actually populated by the elevation tokens. */
export type ElevationStyle = Pick<
  ViewStyle,
  | "shadowColor"
  | "shadowOffset"
  | "shadowOpacity"
  | "shadowRadius"
  | "elevation"
>;

const iosShadows: Record<ElevationLevel, ElevationStyle> = {
  level0: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  level1: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  level2: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  level3: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
};

const androidElevation: Record<ElevationLevel, ElevationStyle> = {
  level0: { elevation: 0 },
  level1: { elevation: 1 },
  level2: { elevation: 3 },
  level3: { elevation: 8 },
};

/**
 * Resolve an elevation level to a platform-appropriate style fragment.
 * Spread this directly into a `View`'s style prop.
 */
export function elevationStyle(level: ElevationLevel): ElevationStyle {
  return Platform.select({
    ios: iosShadows[level],
    android: androidElevation[level],
    // Web inherits the iOS shadow shape; React Native Web translates
    // shadow* into a CSS box-shadow for us.
    default: iosShadows[level],
  })!;
}

export const elevation = {
  level0: () => elevationStyle("level0"),
  level1: () => elevationStyle("level1"),
  level2: () => elevationStyle("level2"),
  level3: () => elevationStyle("level3"),
} as const;
