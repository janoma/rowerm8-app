/**
 * Compact summary row for a stored activity.
 *
 * Used both by the History tab (full list) and the Home "Recent
 * activities" peek. The visual weight is light — date as the primary
 * line, then a single helper line with duration, stroke count, and
 * (optionally) avg cadence + HR.
 */
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { StoredActivity } from "@/lib/activity/storage";
import { useFormatters } from "@/lib/format/use-formatters";

export type ActivityCardPalette = {
  cardBg: string;
  cardBorder: string;
  cardHelper: string;
  chevron: string;
};

export type ActivityCardProps = {
  activity: StoredActivity;
  palette: ActivityCardPalette;
  onPress: () => void;
  /** When true, drops the secondary cadence/HR row to keep the card
   * height tight (used by the Home peek). */
  compact?: boolean;
};

export function ActivityCard({
  activity,
  palette,
  onPress,
  compact = false,
}: ActivityCardProps) {
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
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardBody}>
        <ThemedText style={styles.cardDate}>{dateLabel}</ThemedText>
        <View style={styles.cardRow}>
          <ThemedText
            style={[styles.cardPrimary, { color: palette.cardHelper }]}
          >
            {durationLabel}
          </ThemedText>
          <ThemedText style={[styles.cardDot, { color: palette.cardHelper }]}>
            ·
          </ThemedText>
          <ThemedText
            style={[styles.cardPrimary, { color: palette.cardHelper }]}
          >
            {strokesLabel}
          </ThemedText>
        </View>
        {!compact && (cadenceLabel || hrLabel) ? (
          <View style={styles.cardRow}>
            {cadenceLabel ? (
              <ThemedText
                style={[styles.cardSecondary, { color: palette.cardHelper }]}
              >
                {cadenceLabel}
              </ThemedText>
            ) : null}
            {cadenceLabel && hrLabel ? (
              <ThemedText
                style={[styles.cardDot, { color: palette.cardHelper }]}
              >
                ·
              </ThemedText>
            ) : null}
            {hrLabel ? (
              <ThemedText
                style={[styles.cardSecondary, { color: palette.cardHelper }]}
              >
                {hrLabel}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
      <IconSymbol name="chevron.right" size={18} color={palette.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
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
