/**
 * Badge — a compact tinted label with semantic tone.
 *
 * Typically used on its own next to a piece of value text, or
 * embedded inside a `<StatusPill>`. For a pill with an icon, prefer
 * `<StatusPill>`; for a pure text tag, prefer `<Chip>`.
 */

import { type ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";
import type { ColorTokens } from "../tokens/colors";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONE_TO_TOKENS: Record<
  BadgeTone,
  { bgKey: keyof ColorTokens; textKey: keyof ColorTokens }
> = {
  neutral: { bgKey: "neutralSubtle", textKey: "textSecondary" },
  accent: { bgKey: "accentSubtle", textKey: "accentText" },
  success: { bgKey: "successBg", textKey: "successText" },
  warning: { bgKey: "warningBg", textKey: "warningText" },
  danger: { bgKey: "dangerBg", textKey: "dangerText" },
  info: { bgKey: "infoBg", textKey: "accentText" },
};

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  style?: ViewStyle;
};

export function Badge({ children, tone = "neutral", style }: BadgeProps) {
  const { tokens } = useTheme();
  const { bgKey, textKey } = TONE_TO_TOKENS[tone];
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tokens.colors[bgKey],
          borderRadius: tokens.radius.sm,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: tokens.colors[textKey] }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
