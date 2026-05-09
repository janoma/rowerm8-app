import { router } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityCard } from "@/components/activity/activity-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useActivities } from "@/hooks/use-activities";
import type { StoredActivity } from "@/lib/activity/storage";
import { EmptyState, useTheme } from "@/lib/design-system";

export default function HistoryScreen() {
  const { tokens } = useTheme();
  const { t } = useTranslation("history");
  const { activities, isLoading, refresh } = useActivities();

  const renderItem = useCallback(
    ({ item }: { item: StoredActivity }) => (
      <ActivityCard
        activity={item}
        onPress={() =>
          router.push({
            pathname: "/activity/[id]",
            params: { id: item.id },
          })
        }
      />
    ),
    [],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }
    return (
      <EmptyState title={t("empty.title")} style={styles.empty}>
        {t("empty.body")}
      </EmptyState>
    );
  }, [isLoading, t]);

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
              <ThemedText
                style={[
                  styles.subtitle,
                  { color: tokens.colors.textSecondary },
                ]}
              >
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
    marginTop: 4,
  },
});
