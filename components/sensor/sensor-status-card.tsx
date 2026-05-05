import { Pressable, StyleSheet, View } from "react-native";

import { BatteryIndicator } from "@/components/ble/battery-indicator";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    surface: "#F2F3F5",
    surfaceBorder: "#E4E6EA",
    label: "#687076",
    accent: "#0a7ea4",
    success: "#1F9D55",
    warning: "#E08A1E",
    warningBg: "rgba(224, 138, 30, 0.15)",
    successBg: "rgba(31, 157, 85, 0.15)",
  },
  dark: {
    surface: "#1F2224",
    surfaceBorder: "#2A2D30",
    label: "#9BA1A6",
    accent: "#3DB7E0",
    success: "#34C759",
    warning: "#FFB020",
    warningBg: "rgba(255, 176, 32, 0.18)",
    successBg: "rgba(52, 199, 89, 0.18)",
  },
} as const;

type Props = {
  /** A motion source has been chosen and persisted (regardless of live status). */
  selected: boolean;
  /** Data is actively flowing from the chosen source right now. */
  connected: boolean;
  deviceLabel: string | null;
  /**
   * Battery percent (0-100) for the active source. Only meaningful while
   * `connected` is true and the source actually reports it (e.g. BLE sensors);
   * pass `null` to hide the indicator.
   */
  batteryPercent?: number | null;
  onPressAction: () => void;
};

export function SensorStatusCard({
  selected,
  connected,
  deviceLabel,
  batteryPercent = null,
  onPressAction,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];

  const iconName = connected
    ? "checkmark.circle.fill"
    : "exclamationmark.triangle.fill";
  const badgeColor = connected ? palette.success : palette.warning;
  const badgeBg = connected ? palette.successBg : palette.warningBg;
  const valueText = selected ? (deviceLabel ?? "Selected") : "Not selected";
  const showSubtitle = selected && !connected;
  const actionText = connected ? "Change" : "Connect";
  const accessibilityLabel = connected
    ? "Change motion sensor"
    : "Connect motion sensor";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
        },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
        <IconSymbol name={iconName} size={26} color={badgeColor} />
      </View>
      <View style={styles.textBlock}>
        <ThemedText style={[styles.label, { color: palette.label }]}>
          MOTION SENSOR
        </ThemedText>
        <ThemedText style={styles.value} numberOfLines={1}>
          {valueText}
        </ThemedText>
        {showSubtitle ? (
          <ThemedText style={[styles.subtitle, { color: palette.warning }]}>
            Not connected
          </ThemedText>
        ) : null}
        {connected && batteryPercent != null ? (
          <View style={styles.batteryRow}>
            <BatteryIndicator
              percent={batteryPercent}
              height={14}
              fontSize={12}
            />
          </View>
        ) : null}
      </View>
      {selected ? (
        <Pressable
          onPress={onPressAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <ThemedText style={[styles.action, { color: palette.accent }]}>
            {actionText}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  value: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 14,
    marginTop: 2,
  },
  batteryRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  action: {
    fontSize: 16,
    fontWeight: "500",
  },
});
