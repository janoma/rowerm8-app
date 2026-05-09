import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { BatteryIndicator } from "@/components/ble/battery-indicator";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { IconSymbolName } from "@/components/ui/icon-symbol";
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
    liveValue: "#11181C",
    separator: "#C7CACE",
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
    liveValue: "#ECEDEE",
    separator: "#3A3D40",
  },
} as const;

export type SensorKind = "motion" | "hr";

type Props = {
  /** Drives copy and accessibility labels. */
  kind: SensorKind;
  /** A device has been chosen and persisted (regardless of live status). */
  selected: boolean;
  /** Data is actively flowing from the chosen source right now. */
  connected: boolean;
  deviceLabel: string | null;
  /**
   * Battery percent (0-100) for the active source. Pass `null` when the source
   * doesn't report battery yet (e.g. HR over the standard service is wired
   * separately and stays null until that landing).
   */
  batteryPercent?: number | null;
  /**
   * Live data preview shown next to the battery row (e.g. "78 bpm" for an HR
   * monitor). Hidden when null/empty.
   */
  liveValue?: string | null;
  onPressAction: () => void;
};

const KIND_ICONS: Record<SensorKind, IconSymbolName> = {
  motion: "dot.radiowaves.left.and.right",
  hr: "heart.fill",
};

export function SensorStatusCard({
  kind,
  selected,
  connected,
  deviceLabel,
  batteryPercent = null,
  liveValue = null,
  onPressAction,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const { t } = useTranslation("sensor");

  const statusIcon = connected
    ? "checkmark.circle.fill"
    : "exclamationmark.triangle.fill";
  const badgeColor = connected ? palette.success : palette.warning;
  const badgeBg = connected ? palette.successBg : palette.warningBg;
  const valueText = selected
    ? (deviceLabel ?? t("status.selected"))
    : t("status.notSelected");
  const showSubtitle = selected && !connected;
  const actionText = connected
    ? t("status.actionChange")
    : t("status.actionConnect");
  const accessibilityLabel = connected
    ? t(`status.${kind}.a11yChange`)
    : t(`status.${kind}.a11yConnect`);

  const showBattery = connected && batteryPercent != null;
  const showLive = connected && !!liveValue;
  const showBottomRow = showBattery || showLive;

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
        {/* Selected = primary kind icon; not selected = warning glyph. The
            badge background already telegraphs status with colour, so the
            kind icon stays useful as a quick "which sensor is this" cue. */}
        <IconSymbol
          name={selected ? KIND_ICONS[kind] : statusIcon}
          size={26}
          color={badgeColor}
        />
      </View>
      <View style={styles.textBlock}>
        <ThemedText style={[styles.label, { color: palette.label }]}>
          {t(`status.${kind}.label`)}
        </ThemedText>
        <ThemedText style={styles.value} numberOfLines={1}>
          {valueText}
        </ThemedText>
        {showSubtitle ? (
          <ThemedText style={[styles.subtitle, { color: palette.warning }]}>
            {t("status.notConnected")}
          </ThemedText>
        ) : null}
        {showBottomRow ? (
          <View style={styles.bottomRow}>
            {showBattery ? (
              <BatteryIndicator
                percent={batteryPercent!}
                height={14}
                fontSize={12}
              />
            ) : null}
            {showBattery && showLive ? (
              <View
                style={[
                  styles.separator,
                  { backgroundColor: palette.separator },
                ]}
              />
            ) : null}
            {showLive ? (
              <ThemedText
                style={[styles.liveValue, { color: palette.liveValue }]}
              >
                {liveValue}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
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
  bottomRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  separator: {
    width: 1,
    height: 12,
  },
  liveValue: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  action: {
    fontSize: 16,
    fontWeight: "500",
  },
});
