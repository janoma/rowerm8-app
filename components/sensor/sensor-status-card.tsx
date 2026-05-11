import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { BatteryIndicator } from "@/components/ble/battery-indicator";
import { ThemedText } from "@/components/themed-text";
import type { IconSymbolName } from "@/components/ui/icon-symbol";
import { Card, Divider, Icon, useTheme } from "@/lib/design-system";

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
  const { tokens } = useTheme();
  const { t } = useTranslation("sensor");

  const statusIcon = connected
    ? "checkmark.circle.fill"
    : "exclamationmark.triangle.fill";
  const badgeColor = connected ? tokens.colors.success : tokens.colors.warning;
  const badgeBg = connected ? tokens.colors.successBg : tokens.colors.warningBg;
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
    <Pressable
      onPress={onPressAction}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card variant="elevated" padding="md" style={styles.card}>
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: badgeBg,
              borderRadius: tokens.radius.pill,
            },
          ]}
        >
          {/* Selected = primary kind icon; not selected = warning glyph. The
              badge background already telegraphs status with colour, so the
              kind icon stays useful as a quick "which sensor is this" cue. */}
          <Icon
            name={selected ? KIND_ICONS[kind] : statusIcon}
            size={26}
            color={badgeColor}
          />
        </View>
        <View style={styles.textBlock}>
          <ThemedText
            style={[styles.label, { color: tokens.colors.textSecondary }]}
          >
            {t(`status.${kind}.label`)}
          </ThemedText>
          <ThemedText style={styles.value} numberOfLines={1}>
            {valueText}
          </ThemedText>
          {showSubtitle ? (
            <ThemedText
              style={[styles.subtitle, { color: tokens.colors.warning }]}
            >
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
                <Divider style={styles.verticalDivider} />
              ) : null}
              {showLive ? (
                <ThemedText
                  style={[styles.liveValue, { color: tokens.colors.text }]}
                >
                  {liveValue}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>
        {/* The action label is now a visual affordance only — the entire card
            is the press target (see outer Pressable). */}
        <ThemedText style={[styles.action, { color: tokens.colors.accent }]}>
          {actionText}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
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
  // The Divider primitive is a horizontal hairline by default; here we want a
  // 1×12 vertical separator between the battery and the live value, so we
  // override its dimensions.
  verticalDivider: {
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
