/**
 * Compact summary row for a stored activity.
 *
 * Used both by the History tab (full list) and the Home "Recent
 * activities" peek. The visual weight is light — date as the primary
 * line, then a single helper line with duration, stroke count, and
 * (optionally) avg cadence + HR.
 *
 * Reads colors from the design-system theme via `useTheme()`. The
 * old `palette` prop has been removed — see the design-system plan
 * Risks section ("ActivityCard palette migration is breaking-API").
 */
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { StoredActivity } from "@/lib/activity/storage";
import { Icon, useTheme } from "@/lib/design-system";
import { useFormatters } from "@/lib/format/use-formatters";

export type ActivityCardProps = {
  activity: StoredActivity;
  onPress: () => void;
  /** When true, drops the secondary cadence/HR row to keep the card
   * height tight (used by the Home peek). */
  compact?: boolean;
};

export function ActivityCard({
  activity,
  onPress,
  compact = false,
}: ActivityCardProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation("history");
  const formatters = useFormatters();
  const { summary } = activity;
  const startedAt = new Date(summary.startedAtMs);
  const dateLabel = formatters.dateTime(startedAt);
  const durationLabel = formatters.duration(summary.durationS);
  const strokesLabel = t("card.strokes", { count: summary.strokeCount });
  const cadenceLabel =
    summary.avgCadenceSpm > 0
      ? t("card.avgCadence", { cadence: Math.round(summary.avgCadenceSpm) })
      : null;
  const hrLabel =
    summary.avgHeartRateBpm != null
      ? t("card.avgHeartRate", { bpm: Math.round(summary.avgHeartRateBpm) })
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: tokens.colors.surfaceElevated,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardBody}>
        <ThemedText style={styles.cardDate}>{dateLabel}</ThemedText>
        <View style={styles.cardRow}>
          <ThemedText
            style={[styles.cardPrimary, { color: tokens.colors.textSecondary }]}
          >
            {durationLabel}
          </ThemedText>
          <ThemedText
            style={[styles.cardDot, { color: tokens.colors.textSecondary }]}
          >
            ·
          </ThemedText>
          <ThemedText
            style={[styles.cardPrimary, { color: tokens.colors.textSecondary }]}
          >
            {strokesLabel}
          </ThemedText>
        </View>
        {!compact && (cadenceLabel || hrLabel) ? (
          <View style={styles.cardRow}>
            {cadenceLabel ? (
              <ThemedText
                style={[
                  styles.cardSecondary,
                  { color: tokens.colors.textSecondary },
                ]}
              >
                {cadenceLabel}
              </ThemedText>
            ) : null}
            {cadenceLabel && hrLabel ? (
              <ThemedText
                style={[styles.cardDot, { color: tokens.colors.textSecondary }]}
              >
                ·
              </ThemedText>
            ) : null}
            {hrLabel ? (
              <ThemedText
                style={[
                  styles.cardSecondary,
                  { color: tokens.colors.textSecondary },
                ]}
              >
                {hrLabel}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
      <Icon name="chevron.right" size={18} tone="textTertiary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  cardPrimary: {
    fontSize: 14,
    lineHeight: 18,
  },
  cardSecondary: {
    fontSize: 13,
    lineHeight: 17,
  },
  cardDot: {
    fontSize: 14,
    lineHeight: 18,
  },
});
