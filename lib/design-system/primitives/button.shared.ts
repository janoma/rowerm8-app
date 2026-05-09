/**
 * Shared types and tone resolution for the platform-flavored
 * `<Button>` primitives. The .ios / .android / web (default) files
 * each import these and apply their own visual treatment on top.
 */

import type { ComponentProps } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { IconSymbol } from "@/components/ui/icon-symbol";

import type { ColorTokens } from "../tokens/colors";

/**
 * Visual style:
 *   - `filled` — solid background, on-color text. Primary CTAs.
 *   - `tinted` — soft tinted bg (e.g. `dangerBg`), tone-color text.
 *   - `plain`  — no background, tone-color text. Used for "Share"
 *                style affordances and the share/discard pair on the
 *                activity detail screen.
 */
export type ButtonVariant = "filled" | "tinted" | "plain";

/**
 * Semantic intent. Maps to color tokens consistently across variants.
 */
export type ButtonTone = "accent" | "danger" | "neutral";

export type ButtonSize = "md" | "lg";

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Optional leading icon. */
  icon?: ComponentProps<typeof IconSymbol>["name"];
  /** Renders a small spinner in place of the icon when true. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to fill horizontal space. */
  block?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export type ResolvedButtonColors = {
  /** Background fill (transparent for `plain`). */
  background: string;
  /** Border color (mostly transparent). */
  border: string;
  /** Text + icon color. */
  foreground: string;
  /** Pressed-state overlay opacity multiplier hint (0…1). */
  pressedOpacity: number;
};

/**
 * Resolve color slots for a (variant, tone) pair. Used by both the
 * iOS and Android impls so the *colors* stay consistent — only the
 * shape (radius, padding, ripple) differs by platform.
 */
export function resolveButtonColors(
  variant: ButtonVariant,
  tone: ButtonTone,
  colors: ColorTokens,
  disabled: boolean,
): ResolvedButtonColors {
  const transparent = "transparent";

  // Map tone → token names so each variant can pick consistently.
  const accentSolid =
    tone === "accent"
      ? colors.accent
      : tone === "danger"
        ? colors.dangerStrong
        : colors.surfaceElevated;
  const accentSubtle =
    tone === "accent"
      ? colors.accentSubtle
      : tone === "danger"
        ? colors.dangerBg
        : colors.neutralSubtle;
  const accentSubtleBorder =
    tone === "accent"
      ? colors.accentSubtleBorder
      : tone === "danger"
        ? colors.dangerBorder
        : colors.neutralSubtleBorder;
  const accentText =
    tone === "accent"
      ? colors.accent
      : tone === "danger"
        ? colors.dangerText
        : colors.text;
  const onAccentText = tone === "neutral" ? colors.text : colors.textOnAccent;

  let resolved: ResolvedButtonColors;
  switch (variant) {
    case "filled":
      resolved = {
        background: accentSolid,
        border: transparent,
        foreground: onAccentText,
        pressedOpacity: 0.85,
      };
      break;
    case "tinted":
      resolved = {
        background: accentSubtle,
        border: accentSubtleBorder,
        foreground: accentText,
        pressedOpacity: 0.85,
      };
      break;
    case "plain":
      resolved = {
        background: transparent,
        border: transparent,
        foreground: accentText,
        pressedOpacity: 0.6,
      };
      break;
  }

  if (disabled) {
    return {
      ...resolved,
      pressedOpacity: 1,
    };
  }
  return resolved;
}
