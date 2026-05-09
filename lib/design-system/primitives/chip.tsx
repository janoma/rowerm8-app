/**
 * Chip — a pill-shaped tag, optionally selectable.
 *
 * Visually similar to a `<Badge>` but larger (touch-target sized) and
 * intended for filter / picker use. The selected chip flips to the
 * accent fill so it reads as "currently active".
 */

import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { useTheme } from "../provider";

export type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  /** Disable the press affordance and dim the chip. */
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function Chip({
  children,
  selected = false,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: ChipProps) {
  const { tokens } = useTheme();
  const bg = selected ? tokens.colors.accent : tokens.colors.surfaceElevated;
  const fg = selected ? tokens.colors.textOnAccent : tokens.colors.text;
  const border = selected ? tokens.colors.accent : tokens.colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: tokens.radius.pill,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
