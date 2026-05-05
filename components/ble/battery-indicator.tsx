import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    label: "#11181C",
    body: "#A1A6AB",
    fill: "#34C759",
    fillLow: "#FF9F0A",
    fillCritical: "#FF3B30",
  },
  dark: {
    label: "#ECEDEE",
    body: "#7C8186",
    fill: "#30D158",
    fillLow: "#FFD60A",
    fillCritical: "#FF6961",
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
 * iOS-style battery icon: rounded body with a 1 px outline, a snug nub butted
 * against the right edge, and a colored fill inset by uniform padding so the
 * gap around the fill is identical on all four sides.
 */
export function BatteryIndicator({
  percent,
  height = 14,
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

  // All measurements derive from `height` so the icon scales cleanly. Layout
  // uses padding (instead of absolute positioning) for the fill so the
  // top/left/right/bottom gaps are identical regardless of border width.
  const bodyHeight = height;
  const bodyWidth = Math.round(bodyHeight * 2);
  const nubHeight = Math.round(bodyHeight * 0.5);
  const nubWidth = Math.max(2, Math.round(bodyHeight * 0.18));
  const borderWidth = 1;
  // Padding equals border width: tight halo of body color, just enough to
  // make the fill look set into the body rather than touching the outline.
  const padding = borderWidth;
  const borderRadius = Math.max(2, Math.round(bodyHeight * 0.3));
  // Inner radius keeps the fill visually concentric with the outer body —
  // each layer (border, padding) shaves one pixel off the curvature.
  const innerRadius = Math.max(1, borderRadius - borderWidth - padding);
  const innerMaxWidth = bodyWidth - 2 * borderWidth - 2 * padding;
  const innerWidth = Math.max(1, Math.round((innerMaxWidth * clamped) / 100));

  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel={`Battery ${clamped} percent`}
    >
      <View style={styles.iconRow}>
        <View
          style={[
            styles.body,
            {
              width: bodyWidth,
              height: bodyHeight,
              borderColor: palette.body,
              borderWidth,
              borderRadius,
              padding,
            },
          ]}
        >
          <View
            style={{
              width: innerWidth,
              height: "100%",
              backgroundColor: fillColor,
              borderRadius: innerRadius,
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
          }}
        />
      </View>
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
  // Body and nub render as one inline shape with no gap between them.
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  label: {
    marginLeft: 5,
    fontWeight: "500",
  },
});
