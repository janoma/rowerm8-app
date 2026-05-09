import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/lib/design-system";

/**
 * Pick the battery-fill color for a percentage. Uses the design-system
 * status colors so the icon stays consistent with the rest of the app:
 *   ≤ 15% — danger red,
 *   ≤ 35% — warning orange,
 *   else  — success green.
 */
function fillColorFor(
  percent: number,
  colors: {
    success: string;
    warning: string;
    danger: string;
  },
) {
  if (percent <= 15) {
    return colors.danger;
  }
  if (percent <= 35) {
    return colors.warning;
  }
  return colors.success;
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
  const { tokens } = useTheme();
  const { t } = useTranslation("ble");
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const fillColor = fillColorFor(clamped, tokens.colors);

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
      accessibilityLabel={t("device.a11yBattery", { percent: clamped })}
    >
      <View style={styles.iconRow}>
        <View
          style={[
            styles.body,
            {
              width: bodyWidth,
              height: bodyHeight,
              borderColor: tokens.colors.textTertiary,
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
            backgroundColor: tokens.colors.textTertiary,
            borderTopRightRadius: 1,
            borderBottomRightRadius: 1,
          }}
        />
      </View>
      <ThemedText
        style={[styles.label, { color: tokens.colors.text, fontSize }]}
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
    marginStart: 5,
    fontWeight: "500",
  },
});
