import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { ThemedView } from "@/components/themed-view";
import { useActivities, useActivity } from "@/hooks/use-activities";
import { useFitRecords } from "@/hooks/use-fit-records";
import type { DecodedActivityRecord } from "@/lib/activity/fit-reader";
import { downsampleMean } from "@/lib/activity/fit-reader";
import { shareFitFile } from "@/lib/activity/share";
import {
  AppHeader,
  Banner,
  Button,
  Card,
  ChartCard,
  EmptyState,
  Stack,
  SummaryRow,
  useTheme,
} from "@/lib/design-system";
import { useFormatters } from "@/lib/format/use-formatters";

/** Number of bars in each sparkline. ~80 looks dense without overflowing
 * on a phone-width card; matches the resolution of typical Strava charts. */
const SPARKLINE_BUCKETS = 80;
const SPARKLINE_HEIGHT = 64;

export default function ActivityDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;
  const { tokens } = useTheme();
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
      <AppHeader
        title={t("detail.headerTitle")}
        onBack={handleBack}
        backLabel={t("title")}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : activity ? (
          <DetailBody
            activity={activity}
            formatters={formatters}
            fitRecords={fit.decoded?.records ?? []}
            isFitLoading={fit.isLoading}
            fitError={fit.error}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        ) : (
          <EmptyState
            title={t("detail.notFoundTitle")}
            style={styles.emptySpacer}
          >
            {t("detail.notFoundBody")}
          </EmptyState>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function DetailBody({
  activity,
  formatters,
  fitRecords,
  isFitLoading,
  fitError,
  onShare,
  onDelete,
}: {
  activity: NonNullable<ReturnType<typeof useActivity>["activity"]>;
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
    <Stack gap="md">
      <Card padding="none">
        {rows.map((row, idx) => (
          <SummaryRow
            key={row.label}
            label={row.label}
            value={row.value}
            divider={idx < rows.length - 1}
          />
        ))}
      </Card>

      <ChartsSection
        records={fitRecords}
        isLoading={isFitLoading}
        error={fitError}
      />

      <Button
        title={t("detail.share")}
        icon="square.and.arrow.up"
        tone="accent"
        variant="filled"
        size="lg"
        block
        onPress={onShare}
      />

      <Button
        title={t("detail.delete")}
        icon="trash"
        tone="danger"
        variant="tinted"
        block
        onPress={onDelete}
      />
    </Stack>
  );
}

function ChartsSection({
  records,
  isLoading,
  error,
}: {
  records: DecodedActivityRecord[];
  isLoading: boolean;
  error: Error | null;
}) {
  const { tokens } = useTheme();
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
      <Card>
        <ActivityIndicator color={tokens.colors.accent} />
      </Card>
    );
  }

  if (error) {
    return (
      <Banner tone="warning" title={t("detail.loadFailedTitle")}>
        {t("detail.loadFailedBody")}
      </Banner>
    );
  }

  return (
    <Stack gap="md">
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
        metric="cadence"
        height={SPARKLINE_HEIGHT}
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
        metric="heart"
        height={SPARKLINE_HEIGHT}
      />
    </Stack>
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
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  loading: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptySpacer: {
    marginTop: 4,
  },
});
