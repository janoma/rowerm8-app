import { StyleSheet, View } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";

const TOTAL_BARS = 4;

const COLORS = {
  light: {
    active: "#11181C",
    inactive: "#D1D5DA",
  },
  dark: {
    active: "#ECEDEE",
    inactive: "#3A3D40",
  },
} as const;

/**
 * Map an RSSI (dBm) value to a 0..TOTAL_BARS bucket.
 * Typical BLE ranges:
 *   >= -55 excellent, -65 good, -75 fair, -85 weak, < -85 unusable.
 */
function rssiToBars(rssi: number | null): number {
  if (rssi == null) {
    return 0;
  }
  if (rssi >= -55) {
    return 4;
  }
  if (rssi >= -65) {
    return 3;
  }
  if (rssi >= -75) {
    return 2;
  }
  if (rssi >= -85) {
    return 1;
  }
  return 0;
}

export function SignalBars({
  rssi,
  size = "md",
}: {
  rssi: number | null;
  size?: "sm" | "md";
}) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const filled = rssiToBars(rssi);
  const dims = size === "sm" ? SIZES.sm : SIZES.md;

  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel={`Signal strength ${filled} of ${TOTAL_BARS}`}
    >
      {Array.from({ length: TOTAL_BARS }).map((_, i) => {
        const heightPct = ((i + 1) / TOTAL_BARS) * 100;
        const isActive = i < filled;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                width: dims.barWidth,
                height: dims.maxHeight * (heightPct / 100),
                backgroundColor: isActive ? palette.active : palette.inactive,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const SIZES = {
  sm: { barWidth: 3, maxHeight: 12 },
  md: { barWidth: 4, maxHeight: 16 },
} as const;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: {
    borderRadius: 1,
  },
});
