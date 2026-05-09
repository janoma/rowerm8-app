/**
 * Typography tokens.
 *
 * Two layers:
 *
 *   1. `fonts` — platform-resolved font *family* strings. We DO NOT
 *      `import { Platform } from "react-native"` here because the
 *      Next.js website needs to import this module too. Instead we
 *      ship native and web maps separately and let the runtime layer
 *      (a one-line wrapper in `lib/design-system/provider/use-theme`)
 *      pick the right one. This keeps the tokens bundle pure data.
 *
 *   2. `text` — semantic style scale: display / title / subtitle /
 *      body / bodyEm / caption / label / mono*.  Each entry is a
 *      pure-data object with `fontSize`, `lineHeight`, `fontWeight`,
 *      and (for `label`) `letterSpacing` and `textTransform`.
 */

export type FontFamilies = {
  /** System sans (San Francisco / Roboto / Segoe UI). */
  sans: string;
  /** System serif. */
  serif: string;
  /** Rounded variant; falls back to `sans` if unavailable. */
  rounded: string;
  /** Monospaced — preferred for big numerals (cadence, pace, time). */
  mono: string;
};

/** iOS (and other Apple platforms) — uses `UIFontDescriptorSystemDesign*` aliases. */
export const fontsIos: FontFamilies = {
  sans: "system-ui",
  serif: "ui-serif",
  rounded: "ui-rounded",
  mono: "ui-monospace",
};

/** Android & "other native" default — Roboto and `monospace` are guaranteed. */
export const fontsAndroid: FontFamilies = {
  sans: "normal",
  serif: "serif",
  rounded: "normal",
  mono: "monospace",
};

/** Web — verbose stacks so the browser picks the best installed face. */
export const fontsWeb: FontFamilies = {
  sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  rounded:
    "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
  mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};

export type TextStyleToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight: "300" | "400" | "500" | "600" | "700" | "800" | "normal" | "bold";
  letterSpacing?: number;
  textTransform?: "uppercase" | "lowercase" | "capitalize" | "none";
};

/** Semantic text-style scale. Pair with the right family from `fonts*`. */
export const text = {
  /** 56/64 — hero numerals (cadence on the live row screen). */
  display: { fontSize: 56, lineHeight: 64, fontWeight: "800" } as const,
  /** 36/42 — secondary stat numerals. */
  metric: { fontSize: 36, lineHeight: 42, fontWeight: "700" } as const,
  /** 32/38 — screen titles. */
  title: { fontSize: 32, lineHeight: 38, fontWeight: "700" } as const,
  /** 20/26 — section headlines. */
  subtitle: { fontSize: 20, lineHeight: 26, fontWeight: "700" } as const,
  /** 17/22 — primary list-row labels (iOS standard). */
  bodyLg: { fontSize: 17, lineHeight: 22, fontWeight: "600" } as const,
  /** 16/24 — default body. */
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" } as const,
  /** 16/24 — emphasized body, used for in-text actions. */
  bodyEm: { fontSize: 16, lineHeight: 24, fontWeight: "600" } as const,
  /** 15/20 — secondary subtitles, summary value cells. */
  bodySm: { fontSize: 15, lineHeight: 20, fontWeight: "500" } as const,
  /** 14/18 — supporting / helper text. */
  caption: { fontSize: 14, lineHeight: 18, fontWeight: "400" } as const,
  /** 13/18 — small caption. */
  captionSm: { fontSize: 13, lineHeight: 18, fontWeight: "400" } as const,
  /** 12/14 — micro-label, often paired with `letterSpacing`. */
  micro: { fontSize: 12, lineHeight: 14, fontWeight: "600" } as const,
  /** 11/14 — tracked uppercase labels above stats. */
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  } as const,
} satisfies Record<string, TextStyleToken>;

export type TextStyleKey = keyof typeof text;
export type TypographyTokens = {
  fonts: FontFamilies;
  text: typeof text;
};

export const typography = { text } as const;
