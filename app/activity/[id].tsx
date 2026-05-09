import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
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

import { Sparkline } from "@/components/activity/sparkline";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useActivities, useActivity } from "@/hooks/use-activities";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFitRecords } from "@/hooks/use-fit-records";
import type { DecodedActivityRecord } from "@/lib/activity/fit-reader";
import { downsampleMean } from "@/lib/activity/fit-reader";
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
    chartTrack: "rgba(10, 126, 164, 0.10)",
    cadenceBar: "#0a7ea4",
    heartRateBar: "#C5283D",
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
    chartTrack: "rgba(61, 183, 224, 0.16)",
    cadenceBar: "#3DB7E0",
    heartRateBar: "#E94B5E",
  },
} as const;

/** Number of bars in each sparkline. ~80 looks dense without overflowing
 * on a phone-width card; matches the resolution of typical Strava charts. */
const SPARKLINE_BUCKETS = 80;
const SPARKLINE_HEIGHT = 64;

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
  const fit = useFitRecords(activity?.fitFileUri);

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
            fitRecords={fit.decoded?.records ?? []}
            isFitLoading={fit.isLoading}
            fitError={fit.error}
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
  fitRecords,
  isFitLoading,
  fitError,
  onShare,
  onDelete,
}: {
  activity: NonNullable<ReturnType<typeof useActivity>["activity"]>;
  palette: Palette;
  formatters: ReturnType<typeof useFormatters>;
  fitRecords: DecodedActivityRecord[];
  isFitLoading: boolean;
  fitError: Error | null;
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

      <ChartsSection
        records={fitRecords}
        isLoading={isFitLoading}
        error={fitError}
        palette={palette}
      />

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

function ChartsSection({
  records,
  isLoading,
  error,
  palette,
}: {
  records: DecodedActivityRecord[];
  isLoading: boolean;
  error: Error | null;
  palette: Palette;
}) {
  const { t } = useTranslation("history");

  // Compute the bucketed series + headline stats once per record stream.
  // The detail screen otherwise re-renders on focus events that don't
  // change the FIT data; redoing the bucket math wastes ~ms per render.
  const cadence = useMemo(
    () => bucketAndStats(records.map((r) => r.cadenceSpm)),
    [records],
  );
  const heartRate = useMemo(
    () => bucketAndStats(records.map((r) => r.heartRateBpm)),
    [records],
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.chartCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.chartCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        <ThemedText style={[styles.chartTitle, { color: palette.dangerText }]}>
          {t("detail.loadFailedTitle")}
        </ThemedText>
        <ThemedText style={[styles.chartSubtitle, { color: palette.helper }]}>
          {t("detail.loadFailedBody")}
        </ThemedText>
      </View>
    );
  }

  return (
    <>
      <ChartCard
        title={t("detail.charts.cadence.title")}
        subtitle={
          cadence.count > 0
            ? t("detail.charts.cadence.subtitle", {
                avg: cadence.avg,
                max: cadence.max,
              })
            : t("detail.charts.cadence.noData")
        }
        values={cadence.buckets}
        barColor={palette.cadenceBar}
        trackColor={palette.chartTrack}
        palette={palette}
      />
      <ChartCard
        title={t("detail.charts.heartRate.title")}
        subtitle={
          heartRate.count > 0
            ? t("detail.charts.heartRate.subtitle", {
                avg: heartRate.avg,
                max: heartRate.max,
              })
            : t("detail.charts.heartRate.noData")
        }
        values={heartRate.buckets}
        barColor={palette.heartRateBar}
        trackColor={palette.chartTrack}
        palette={palette}
      />
    </>
  );
}

function ChartCard({
  title,
  subtitle,
  values,
  barColor,
  trackColor,
  palette,
}: {
  title: string;
  subtitle: string;
  values: (number | null)[];
  barColor: string;
  trackColor: string;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.chartCard,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
        },
      ]}
    >
      <ThemedText style={styles.chartTitle}>{title}</ThemedText>
      <ThemedText style={[styles.chartSubtitle, { color: palette.helper }]}>
        {subtitle}
      </ThemedText>
      <Sparkline
        values={values}
        height={SPARKLINE_HEIGHT}
        color={barColor}
        trackColor={trackColor}
      />
    </View>
  );
}

/** Compute headline stats and a bucketed series for a single channel.
 * Returns a `count` of 0 when no values were observed so the caller can
 * render the "no data" stub instead of a flat empty chart. */
function bucketAndStats(values: (number | null)[]): {
  buckets: (number | null)[];
  avg: number;
  max: number;
  count: number;
} {
  const finite = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (finite.length === 0) {
    return { buckets: [], avg: 0, max: 0, count: 0 };
  }
  const buckets = downsampleMean(values, SPARKLINE_BUCKETS);
  const sum = finite.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / finite.length);
  const max = Math.round(Math.max(...finite));
  return { buckets, avg, max, count: finite.length };
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
  chartCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  chartSubtitle: {
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 4,
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
