/**
 * Icon — a thin, theme-aware wrapper over the existing `IconSymbol`
 * component (which already maps SF Symbols → MaterialIcons on
 * Android/web).
 *
 * Accepts a color *token role* (`"text"`, `"accent"`, `"success"`, …)
 * instead of a raw hex, so call sites don't need to read the theme
 * themselves.
 */

import { type ComponentProps } from "react";

import { IconSymbol } from "@/components/ui/icon-symbol";

import { useTheme } from "../provider";
import type { ColorTokens } from "../tokens/colors";

export type IconTone =
  | "text"
  | "textSecondary"
  | "textTertiary"
  | "accent"
  | "accentText"
  | "success"
  | "warning"
  | "danger"
  | "info";

const ROLE_TO_TOKEN: Record<IconTone, keyof ColorTokens> = {
  text: "text",
  textSecondary: "textSecondary",
  textTertiary: "textTertiary",
  accent: "accent",
  accentText: "accentText",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export type IconProps = {
  name: ComponentProps<typeof IconSymbol>["name"];
  size?: number;
  /** A token role; defaults to `"text"`. Use `color` to override with a hex. */
  tone?: IconTone;
  /** Raw color override; bypasses `tone`. */
  color?: string;
  style?: ComponentProps<typeof IconSymbol>["style"];
};

export function Icon({
  name,
  size = 20,
  tone = "text",
  color,
  style,
}: IconProps) {
  const { tokens } = useTheme();
  const resolved = color ?? tokens.colors[ROLE_TO_TOKEN[tone]];
  return <IconSymbol name={name} size={size} color={resolved} style={style} />;
}
