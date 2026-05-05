import { Pressable, StyleSheet, View } from "react-native";

import { BatteryIndicator } from "@/components/ble/battery-indicator";
import { SignalBars } from "@/components/ble/signal-bars";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ScannedDevice } from "@/contexts/ble-context";

const COLORS = {
  light: {
    surface: "#F2F3F5",
    surfaceBorder: "#E4E6EA",
    accentBar: "#0a7ea4",
    iconActive: "#0a7ea4",
    iconActiveBg: "rgba(10, 126, 164, 0.18)",
    title: "#11181C",
    subtitle: "#687076",
    chevron: "#9BA1A6",
  },
  dark: {
    surface: "#1F2224",
    surfaceBorder: "#2A2D30",
    accentBar: "#3DB7E0",
    iconActive: "#3DB7E0",
    iconActiveBg: "rgba(61, 183, 224, 0.22)",
    title: "#ECEDEE",
    subtitle: "#9BA1A6",
    chevron: "#7C8186",
  },
} as const;

type Props = {
  device: ScannedDevice;
  busy?: boolean;
  /** 0..100 — when null/undefined, the battery slot is hidden. */
  batteryPercent?: number | null;
  onPress: (device: ScannedDevice) => void;
};

export function DeviceCard({
  device,
  busy = false,
  batteryPercent = null,
  onPress,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];

  const displayName =
    device.name ?? device.localName ?? `Unknown ${device.id.slice(-5)}`;
  const subtitle = device.decoder?.vendorDescription ?? "Unknown vendor";

  return (
    <Pressable
      onPress={() => onPress(device)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Connect to ${displayName}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          opacity: busy ? 0.5 : pressed ? 0.85 : 1,
          borderLeftColor: palette.accentBar,
          borderLeftWidth: 3,
        },
      ]}
    >
      <View
        style={[styles.iconBadge, { backgroundColor: palette.iconActiveBg }]}
      >
        <IconSymbol
          name="dot.radiowaves.right"
          size={22}
          color={palette.iconActive}
        />
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.textColumn}>
          <ThemedText
            style={[styles.title, { color: palette.title }]}
            numberOfLines={1}
          >
            {displayName}
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: palette.subtitle }]}
            numberOfLines={1}
          >
            {subtitle}
          </ThemedText>
        </View>

        <View style={styles.metaColumn}>
          <View style={styles.metaTopSlot}>
            <SignalBars rssi={device.rssi} size="lg" />
          </View>
          <View style={styles.metaBottomSlot}>
            {batteryPercent != null ? (
              <BatteryIndicator
                percent={batteryPercent}
                height={11}
                fontSize={12}
              />
            ) : null}
          </View>
        </View>
      </View>

      <IconSymbol name="chevron.right" size={18} color={palette.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Right-side meta column has two stacked slots whose heights mirror the
  // text column (title + subtitle) so the signal bars line up with the title
  // row and the battery lines up with the subtitle row.
  metaColumn: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  metaTopSlot: {
    height: 22,
    justifyContent: "center",
  },
  metaBottomSlot: {
    height: 18,
    justifyContent: "center",
  },
});
