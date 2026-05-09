import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useActivity, useActivities } from "@/hooks/use-activities";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { shareFitFile } from "@/lib/activity/share";
import { useFormatters } from "@/lib/format/use-formatters";

const COLORS = {
  light: {
    accent: "#0a7ea4",
    helper: "#687076",
    cardBg: "#FFFFFF",
    cardBorder: "#E2E5E8",
    rowBorder: "#EFF1F3",
    primaryBg: "#0a7ea4",
    primaryText: "#FFFFFF",
    dangerBg: "rgba(197, 40, 61, 0.10)",
    dangerText: "#C5283D",
    emptyBorder: "#D1D5DA",
    emptyText: "#9BA1A6",
  },
  dark: {
    accent: "#3DB7E0",
    helper: "#9BA1A6",
    cardBg: "#181B1F",
    cardBorder: "#2A2E33",
    rowBorder: "#1F2226",
    primaryBg: "#3DB7E0",
    primaryText: "#0B1115",
    dangerBg: "rgba(233, 75, 94, 0.18)",
    dangerText: "#E94B5E",
    emptyBorder: "#2F3236",
    emptyText: "#6E7174",
  },
} as const;

type Palette = (typeof COLORS)[keyof typeof COLORS];

export default function ActivityDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("history");
  const formatters = useFormatters();

  const { activity, isLoading } = useActivity(id);
  const { remove } = useActivities();

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleShare = useCallback(async () => {
    if (!activity) {
      return;
    }
    try {
      const result = await shareFitFile(
        activity.fitFileUri,
        t("detail.shareDialogTitle"),
      );
      if (result === "unavailable") {
        Alert.alert(t("detail.shareUnavailable"));
      }
    } catch (e) {
      // The user dismissing the iOS share sheet rejects the promise; we
      // don't surface that as an error.
      console.warn("[activity-detail] share failed", e);
    }
  }, [activity, t]);

  const handleDelete = useCallback(() => {
    if (!activity) {
      return;
    }
    Alert.alert(t("detail.deleteTitle"), t("detail.deleteBody"), [
      { text: t("detail.deleteCancel"), style: "cancel" },
      {
        text: t("detail.deleteConfirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await remove(activity.id);
          } catch (e) {
            console.warn("[activity-detail] delete failed", e);
          }
          router.back();
        },
      },
    ]);
  }, [activity, remove, t]);

  return (
    <ThemedView style={styles.root}>
      <View style={[styles.safeTop, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.navBar}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={20} color={palette.accent} />
            <ThemedText style={[styles.backLabel, { color: palette.accent }]}>
              {t("title")}
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.navTitle}>
            {t("detail.headerTitle")}
          </ThemedText>
          <View style={styles.navActionPlaceholder} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : activity ? (
          <DetailBody
            activity={activity}
            palette={palette}
            formatters={formatters}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        ) : (
          <View
            style={[styles.empty, { borderColor: palette.emptyBorder }]}
            accessibilityRole="text"
          >
            <ThemedText
              style={[styles.emptyTitle, { color: palette.emptyText }]}
            >
              {t("detail.notFoundTitle")}
            </ThemedText>
            <ThemedText
              style={[styles.emptyBody, { color: palette.emptyText }]}
            >
              {t("detail.notFoundBody")}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function DetailBody({
  activity,
  palette,
  formatters,
  onShare,
  onDelete,
}: {
  activity: NonNullable<ReturnType<typeof useActivity>["activity"]>;
  palette: Palette;
  formatters: ReturnType<typeof useFormatters>;
  onShare: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("history");
  const { summary } = activity;
  const startedAt = new Date(summary.startedAtMs);
  const endedAt = new Date(summary.endedAtMs);

  const rows: { label: string; value: string }[] = [
    {
      label: t("detail.summary.duration"),
      value: formatters.duration(summary.durationS),
    },
    {
      label: t("detail.summary.strokes"),
      value: String(summary.strokeCount),
    },
  ];

  if (summary.avgCadenceSpm > 0) {
    rows.push({
      label: t("detail.summary.avgCadence"),
      value: `${Math.round(summary.avgCadenceSpm)} spm`,
    });
  }

  if (
    Number.isFinite(summary.avgPaceSecondsPer500m) &&
    summary.avgPaceSecondsPer500m > 0
  ) {
    // Convert seconds-per-500m back to m/s so the user's pace-unit
    // preference (per500m / perKm / perMile) is honoured.
    const avgMps = 500 / summary.avgPaceSecondsPer500m;
    rows.push({
      label: t("detail.summary.avgPace"),
      value: formatters.pace(avgMps),
    });
  }

  if (summary.avgHeartRateBpm != null) {
    rows.push({
      label: t("detail.summary.avgHeartRate"),
      value: `${Math.round(summary.avgHeartRateBpm)} bpm`,
    });
  }
  if (summary.maxHeartRateBpm != null) {
    rows.push({
      label: t("detail.summary.maxHeartRate"),
      value: `${Math.round(summary.maxHeartRateBpm)} bpm`,
    });
  }

  rows.push({
    label: t("detail.summary.started"),
    value: formatters.dateTime(startedAt),
  });
  rows.push({
    label: t("detail.summary.ended"),
    value: formatters.dateTime(endedAt),
  });

  return (
    <View style={styles.detailRoot}>
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        {rows.map((row, idx) => (
          <View
            key={row.label}
            style={[
              styles.summaryRow,
              idx < rows.length - 1
                ? {
                    borderBottomColor: palette.rowBorder,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  }
                : null,
            ]}
          >
            <ThemedText
              style={[styles.summaryLabel, { color: palette.helper }]}
            >
              {row.label}
            </ThemedText>
            <ThemedText style={styles.summaryValue}>{row.value}</ThemedText>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: palette.primaryBg,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <IconSymbol
          name="square.and.arrow.up"
          size={18}
          color={palette.primaryText}
        />
        <ThemedText
          style={[styles.primaryButtonLabel, { color: palette.primaryText }]}
        >
          {t("detail.share")}
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.dangerButton,
          {
            backgroundColor: palette.dangerBg,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <IconSymbol name="trash" size={18} color={palette.dangerText} />
        <ThemedText
          style={[styles.dangerButtonLabel, { color: palette.dangerText }]}
        >
          {t("detail.delete")}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeTop: {
    paddingHorizontal: 16,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 60,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: "500",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  navActionPlaceholder: {
    width: 60,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  loading: {
    paddingVertical: 60,
    alignItems: "center",
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
  detailRoot: {
    gap: 14,
  },
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
  },
  dangerButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
