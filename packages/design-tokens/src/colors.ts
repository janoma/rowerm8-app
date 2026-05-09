/**
 * Semantic color tokens, light + dark.
 *
 * Pure data — NO `react-native` imports here. The tokens are consumed by
 * the in-app `ThemeProvider` (via `lib/design-system/tokens`) and by the
 * future marketing website (Next.js) which imports them straight from
 * `@rowerm8/design-tokens`.
 *
 * Naming convention:
 *   - `surface`, `surfaceElevated`, `surfaceSunken` — backgrounds
 *   - `text`, `textSecondary`, `textTertiary`, `textOnAccent` — content
 *   - `accent` is the brand teal; `accentSubtle` / `accentSubtleBorder`
 *      are the tinted-card wash; `accentText` is the darker accent
 *      readable on `surface`.
 *   - status families share the shape `{ status, statusBg, statusBorder, statusText }`:
 *     `status` is the saturated stroke / icon color, `statusBg` is the
 *     soft background tint, `statusBorder` matches the bg, and `statusText`
 *     is the legible label color *on top of* the bg.
 *   - `dangerStrong` is the saturated red used for filled "Stop" buttons
 *     where we want the button itself to read as alarming. (`danger` is a
 *     touch softer for in-context destructive icons.)
 */

export type ColorTokens = {
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  overlay: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;

  accent: string;
  accentSubtle: string;
  accentSubtleBorder: string;
  accentText: string;
  link: string;

  /** Neutral tinted background used for "secondary" launcher cards etc. */
  neutralSubtle: string;
  neutralSubtleBorder: string;

  success: string;
  successBg: string;
  successBorder: string;
  successText: string;

  warning: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;

  danger: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;
  /** Saturated red for filled destructive buttons. */
  dangerStrong: string;

  info: string;
  infoBg: string;
  infoBorder: string;

  border: string;
  borderStrong: string;
  divider: string;

  /** Translucent placeholder/dashed border seen in empty states. */
  placeholderBorder: string;
  /** Tertiary text-on-empty-state. */
  placeholderText: string;
};

export const lightColors: ColorTokens = {
  surface: "#FFFFFF",
  surfaceElevated: "#F2F3F5",
  surfaceSunken: "#EBEDF0",
  overlay: "rgba(0, 0, 0, 0.45)",

  text: "#11181C",
  textSecondary: "#687076",
  textTertiary: "#9BA1A6",
  textOnAccent: "#FFFFFF",

  accent: "#0A7EA4",
  accentSubtle: "rgba(10, 126, 164, 0.10)",
  accentSubtleBorder: "rgba(10, 126, 164, 0.28)",
  accentText: "#075F7C",
  link: "#0A7EA4",

  neutralSubtle: "rgba(104, 112, 118, 0.12)",
  neutralSubtleBorder: "rgba(104, 112, 118, 0.30)",

  success: "#1F9D55",
  successBg: "rgba(31, 157, 85, 0.15)",
  successBorder: "rgba(31, 157, 85, 0.40)",
  successText: "#1F6F2C",

  warning: "#E08A1E",
  warningBg: "rgba(224, 138, 30, 0.15)",
  warningBorder: "rgba(224, 138, 30, 0.40)",
  warningText: "#9C5E0E",

  danger: "#D02E1F",
  dangerBg: "rgba(208, 46, 31, 0.10)",
  dangerBorder: "rgba(208, 46, 31, 0.40)",
  dangerText: "#C5283D",
  dangerStrong: "#C5283D",

  info: "#0A7EA4",
  infoBg: "rgba(10, 126, 164, 0.10)",
  infoBorder: "rgba(10, 126, 164, 0.28)",

  border: "#E4E6EA",
  borderStrong: "#D1D5DA",
  divider: "#E4E6EA",

  placeholderBorder: "#D1D5DA",
  placeholderText: "#9BA1A6",
};

export const darkColors: ColorTokens = {
  surface: "#151718",
  surfaceElevated: "#1F2224",
  surfaceSunken: "#0F1112",
  overlay: "rgba(0, 0, 0, 0.65)",

  text: "#ECEDEE",
  textSecondary: "#9BA1A6",
  textTertiary: "#6E7174",
  textOnAccent: "#0B1115",

  accent: "#3DB7E0",
  accentSubtle: "rgba(61, 183, 224, 0.14)",
  accentSubtleBorder: "rgba(61, 183, 224, 0.36)",
  accentText: "#7CD3F2",
  link: "#3DB7E0",

  neutralSubtle: "rgba(155, 161, 166, 0.16)",
  neutralSubtleBorder: "rgba(155, 161, 166, 0.34)",

  success: "#34C759",
  successBg: "rgba(52, 199, 89, 0.18)",
  successBorder: "rgba(52, 199, 89, 0.45)",
  successText: "#7BE08F",

  warning: "#FFB020",
  warningBg: "rgba(255, 176, 32, 0.18)",
  warningBorder: "rgba(255, 176, 32, 0.45)",
  warningText: "#FFB020",

  danger: "#FF6369",
  dangerBg: "rgba(233, 75, 94, 0.18)",
  dangerBorder: "rgba(233, 75, 94, 0.45)",
  dangerText: "#E94B5E",
  dangerStrong: "#E94B5E",

  info: "#3DB7E0",
  infoBg: "rgba(61, 183, 224, 0.14)",
  infoBorder: "rgba(61, 183, 224, 0.36)",

  border: "#2A2D30",
  borderStrong: "#3A3D40",
  divider: "#2A2D30",

  placeholderBorder: "#2F3236",
  placeholderText: "#6E7174",
};
