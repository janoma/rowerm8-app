/**
 * 4-pt spacing scale.
 *
 * Use the named keys (`xs`, `sm`, `md`, …) in component code; the raw
 * 4-pt grid is exposed too for one-off needs. The numbers are dp on
 * native and px on web (they map 1:1 in `react-native-web`).
 */

export const spacing = {
  /** 0 px — explicit zero. */
  none: 0,
  /** 4 px — hair gaps between tightly-coupled elements. */
  xxs: 4,
  /** 8 px — chip gaps, badge insets. */
  xs: 8,
  /** 12 px — default tight gap. */
  sm: 12,
  /** 16 px — default card padding, list-row vertical inset. */
  md: 16,
  /** 20 px — screen horizontal padding. */
  lg: 20,
  /** 24 px — section gaps. */
  xl: 24,
  /** 32 px — bottom-of-screen breathing room. */
  xxl: 32,
  /** 40 px — hero stage spacing. */
  "3xl": 40,
  /** 48 px — major composition rhythm. */
  "4xl": 48,
} as const;

export type SpacingToken = keyof typeof spacing;
export type SpacingScale = typeof spacing;
