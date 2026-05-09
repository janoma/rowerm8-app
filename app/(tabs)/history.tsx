import { router } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useActivities } from "@/hooks/use-activities";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFormatters } from "@/lib/format/use-formatters";
import type { StoredActivity } from "@/lib/activity/storage";

const COLORS = {
  light: {
    helper: "#687076",
    cardBg: "#FFFFFF",
    cardBorder: "#E2E5E8",
    cardHelper: "#687076",
    chevron: "#9BA1A6",
    emptyBorder: "#D1D5DA",
    emptyText: "#9BA1A6",
  },
  dark: {
    helper: "#9BA1A6",
    cardBg: "#181B1F",
    cardBorder: "#2A2E33",
    cardHelper: "#9BA1A6",
    chevron: "#6E7174",
    emptyBorder: "#2F3236",
    emptyText: "#6E7174",
  },
} as const;

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const { t } = useTranslation("history");
  const formatters = useFormatters();
  const { activities, isLoading, refresh } = useActivities();

  const renderItem = useCallback(
    ({ item }: { item: StoredActivity }) => (
      <ActivityCard
        activity={item}
        palette={palette}
        formatters={formatters}
        onPress={() =>
          router.push({
            pathname: "/activity/[id]",
            params: { id: item.id },
          })
        }
      />
    ),
    [palette, formatters],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }
    return (
      <View
        style={[styles.empty, { borderColor: palette.emptyBorder }]}
        accessibilityRole="text"
      >
        <ThemedText style={[styles.emptyTitle, { color: palette.emptyText }]}>
          {t("empty.title")}
        </ThemedText>
        <ThemedText style={[styles.emptyBody, { color: palette.emptyText }]}>
          {t("empty.body")}
        </ThemedText>
      </View>
    );
  }, [isLoading, palette, t]);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <FlatList
          data={activities}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                {t("title")}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: palette.helper }]}>
                {t("subtitle")}
              </ThemedText>
            </View>
          }
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} />
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ActivityCard({
  activity,
  palette,
  formatters,
  onPress,
}: {
  activity: StoredActivity;
  palette: (typeof COLORS)[keyof typeof COLORS];
  formatters: ReturnType<typeof useFormatters>;
  onPress: () => void;
}) {
  const { t } = useTranslation("history");
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
      ? t("card.avgHeartRate", {
          bpm: Math.round(summary.avgHeartRateBpm),
        })
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
        {cadenceLabel || hrLabel ? (
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
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  title: {
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
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
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 18,
    gap: 6,
    alignItems: "center",
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
