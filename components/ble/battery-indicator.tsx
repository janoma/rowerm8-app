import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    label: "#11181C",
    body: "#11181C",
    fill: "#1F9D55",
    fillLow: "#E08A1E",
    fillCritical: "#D02E1F",
  },
  dark: {
    label: "#ECEDEE",
    body: "#ECEDEE",
    fill: "#34C759",
    fillLow: "#FFB020",
    fillCritical: "#FF6369",
  },
} as const;

type Palette = (typeof COLORS)[keyof typeof COLORS];

function fillColorFor(percent: number, palette: Palette) {
  if (percent <= 15) {
    return palette.fillCritical;
  }
  if (percent <= 35) {
    return palette.fillLow;
  }
  return palette.fill;
}

/**
 * Compact battery icon (rounded body + terminal nub) plus a percentage label.
 * Sized to align with body text near it; dimensions in props are approximate
 * pixel heights.
 */
export function BatteryIndicator({
  percent,
  height = 12,
  fontSize = 12,
}: {
  percent: number;
  height?: number;
  fontSize?: number;
}) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const fillColor = fillColorFor(clamped, palette);

  const bodyHeight = height;
  const bodyWidth = Math.round(bodyHeight * 1.8);
  const nubHeight = Math.round(bodyHeight * 0.5);
  const nubWidth = Math.max(1, Math.round(bodyHeight * 0.18));
  const innerInset = Math.max(1, Math.round(bodyHeight * 0.15));
  const innerHeight = bodyHeight - innerInset * 2;
  const innerMaxWidth = bodyWidth - innerInset * 2;
  const innerWidth = Math.max(1, Math.round((innerMaxWidth * clamped) / 100));

  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel={`Battery ${clamped} percent`}
    >
      <View
        style={[
          styles.body,
          {
            width: bodyWidth,
            height: bodyHeight,
            borderColor: palette.body,
          },
        ]}
      >
        <View
          style={{
            position: "absolute",
            left: innerInset,
            top: innerInset,
            width: innerWidth,
            height: innerHeight,
            backgroundColor: fillColor,
            borderRadius: 1,
          }}
        />
      </View>
      <View
        style={{
          width: nubWidth,
          height: nubHeight,
          backgroundColor: palette.body,
          borderTopRightRadius: 1,
          borderBottomRightRadius: 1,
          marginLeft: 1,
        }}
      />
      <ThemedText
        style={[styles.label, { color: palette.label, fontSize }]}
        numberOfLines={1}
      >
        {clamped}%
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    borderWidth: 1,
    borderRadius: 2,
    position: "relative",
  },
  label: {
    marginLeft: 4,
    fontWeight: "500",
  },
});
