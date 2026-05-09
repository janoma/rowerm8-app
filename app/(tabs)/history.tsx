import { router } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityCard } from "@/components/activity/activity-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useActivities } from "@/hooks/use-activities";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
  const { activities, isLoading, refresh } = useActivities();

  const renderItem = useCallback(
    ({ item }: { item: StoredActivity }) => (
      <ActivityCard
        activity={item}
        palette={palette}
        onPress={() =>
          router.push({
            pathname: "/activity/[id]",
            params: { id: item.id },
          })
        }
      />
    ),
    [palette],
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
