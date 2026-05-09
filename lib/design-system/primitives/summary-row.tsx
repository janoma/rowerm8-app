/**
 * SummaryRow — a horizontal label/value row for "key: value" summary
 * lists (activity-detail summary card, settings detail screens).
 *
 * Always renders inside a parent that already provides padding (e.g.
 * a `<Card>` with no padding). The optional `divider` prop draws a
 * hairline below the row, used when stacking many SummaryRows in
 * one card.
 */

import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";

export type SummaryRowProps = {
  label: string;
  value: string;
  divider?: boolean;
  style?: ViewStyle;
};

export function SummaryRow({
  label,
  value,
  divider = false,
  style,
}: SummaryRowProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.row,
        divider
          ? {
              borderBottomColor: tokens.colors.border,
              borderBottomWidth: StyleSheet.hairlineWidth,
            }
          : null,
        style,
      ]}
    >
      <Text style={[styles.label, { color: tokens.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.value, { color: tokens.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
  },
});
