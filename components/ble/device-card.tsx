import { Pressable, StyleSheet, View } from "react-native";

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
  onPress: (device: ScannedDevice) => void;
};

export function DeviceCard({ device, busy = false, onPress }: Props) {
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

        {/* Signal slot is sized to match the title's line height so the bars
            sit on the same visual line as the device name rather than the
            vertical center of the card. */}
        <View style={styles.signalSlot}>
          <SignalBars rssi={device.rssi} size="lg" />
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
    alignItems: "flex-start",
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
  signalSlot: {
    height: 22,
    justifyContent: "center",
  },
});
