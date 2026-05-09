import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { SignalBars } from "@/components/ble/signal-bars";
import { ThemedText } from "@/components/themed-text";
import type { ScannedDevice } from "@/contexts/ble-context";
import { Icon, useTheme } from "@/lib/design-system";

type Props = {
  device: ScannedDevice;
  busy?: boolean;
  onPress: (device: ScannedDevice) => void;
};

export function DeviceCard({ device, busy = false, onPress }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("ble");

  const displayName =
    device.name ??
    device.localName ??
    t("device.unknownNamePrefix", { suffix: device.id.slice(-5) });
  const subtitle =
    device.decoder?.vendorDescription ?? t("device.unknownVendor");

  return (
    <Pressable
      onPress={() => onPress(device)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t("device.a11yConnect", { name: displayName })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: tokens.colors.surfaceElevated,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.lg,
          opacity: busy ? 0.5 : pressed ? 0.85 : 1,
          // RTL-safe: borderStartColor flips to the right edge under Arabic.
          borderStartColor: tokens.colors.accent,
          borderStartWidth: 3,
        },
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          {
            backgroundColor: tokens.colors.accentSubtle,
            borderRadius: tokens.radius.pill,
          },
        ]}
      >
        <Icon name="dot.radiowaves.right" size={22} tone="accent" />
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.textColumn}>
          <ThemedText
            style={[styles.title, { color: tokens.colors.text }]}
            numberOfLines={1}
          >
            {displayName}
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: tokens.colors.textSecondary }]}
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

      <Icon name="chevron.right" size={18} tone="textTertiary" />
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 40,
    height: 40,
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
