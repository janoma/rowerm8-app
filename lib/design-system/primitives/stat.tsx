/**
 * Stat — a single metric: tiny tracked-uppercase label above a big
 * monospaced value.
 *
 * Two emphasis levels:
 *   - `primary`   — display-size numeral (56 / 64), accent color,
 *                   wrapped in a tinted surface block. Used for the
 *                   headline cadence on the live row screen.
 *   - `secondary` — metric-size numeral (36 / 42), text color, no
 *                   background. Used for stroke count, pace, elapsed,
 *                   HR.
 *
 * Optional `accent` overrides the value color (used by the HR row to
 * tint with the current zone). Optional `trailing` is rendered to the
 * right of the value (used for the `<ZonePill>` next to HR bpm).
 */

import { type ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";

export type StatEmphasis = "primary" | "secondary";

export type StatProps = {
  label: string;
  /** Pre-formatted value text — `Stat` does not format. */
  value: string;
  emphasis?: StatEmphasis;
  /** Override the value color (e.g. zone tint). */
  accent?: string;
  /** Element rendered next to the value (e.g. a ZonePill). */
  trailing?: ReactNode;
  style?: ViewStyle;
};

export function Stat({
  label,
  value,
  emphasis = "secondary",
  accent,
  trailing,
  style,
}: StatProps) {
  const { tokens, fonts } = useTheme();
  const isPrimary = emphasis === "primary";

  const valueColor =
    accent ?? (isPrimary ? tokens.colors.accent : tokens.colors.text);
  const labelColor = isPrimary
    ? tokens.colors.accentText
    : tokens.colors.textSecondary;

  const valueStyle = isPrimary
    ? [styles.primaryValue, { color: valueColor, fontFamily: fonts.mono }]
    : [styles.secondaryValue, { color: valueColor, fontFamily: fonts.mono }];

  const inner = (
    <>
      <Text
        style={[
          isPrimary ? styles.primaryLabel : styles.secondaryLabel,
          { color: labelColor },
        ]}
      >
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text
          style={valueStyle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={isPrimary ? 0.6 : 0.7}
        >
          {value}
        </Text>
        {trailing}
      </View>
    </>
  );

  if (isPrimary) {
    return (
      <View
        style={[
          styles.primaryWrap,
          {
            backgroundColor: tokens.colors.accentSubtle,
            borderColor: tokens.colors.accentSubtleBorder,
            borderRadius: tokens.radius.md,
          },
          style,
        ]}
      >
        {inner}
      </View>
    );
  }

  return <View style={[styles.secondaryWrap, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  primaryWrap: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  primaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  primaryValue: {
    fontSize: 56,
    fontWeight: "800",
    lineHeight: 64,
  },
  secondaryWrap: {
    gap: 2,
  },
  secondaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  secondaryValue: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
    flexShrink: 1,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
