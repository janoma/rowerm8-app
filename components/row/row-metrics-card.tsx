import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { useFormatters } from "@/lib/format";
import { Card, Stat, ZonePill, useTheme } from "@/lib/design-system";
import { zoneForBpm } from "@/lib/hr/zones";

type Props = {
  strokeCount: number;
  cadenceSpm: number;
  paceSecondsPer500m: number;
  elapsedSeconds: number;
  /**
   * Lap-timer reading in seconds, or `null` when no lap has been started
   * yet (the default). When `null`, the time row collapses to a single
   * full-width Total time stat (visually identical to the pre-C3 card).
   * When non-null, Total time and Lap time render side by side as a
   * two-column row. The lap-button plumbing that drives this value
   * lands in C6.
   */
  lapElapsedSeconds?: number | null;
  /**
   * Live heart rate in bpm. Pass `null`/`undefined` when no HR source is
   * connected or the monitor hasn't reported a reading yet — the row is
   * hidden in that case so users without an HRM don't see a stale "—".
   */
  heartRateBpm?: number | null;
};

/**
 * Glanceable rowing metrics: stroke count, cadence (smoothed), pace
 * estimate, and total time. The cadence and total/lap time values use
 * the existing app-wide formatters so locale-specific number / time
 * formatting stays consistent with the rest of the app. Pace is
 * rendered through `formatPace` and respects the user's pace-unit
 * preference; before the first stroke the boat speed is zero, so
 * `formatPace` renders the em-dash placeholder for us.
 *
 * When `lapElapsedSeconds` is provided, Total time and Lap time share
 * the same row as a two-column grid (each cell `flex: 1`). The same
 * `<StatRow>` helper is the layout reused in C8 for Heart rate +
 * Calories.
 *
 * When `heartRateBpm` is provided, the HR row's value is tinted with
 * the corresponding zone color (via `zoneForBpm()`) and a small
 * `<ZonePill>` is rendered beside it. Until the user-configurable
 * max-HR setting lands (deferred to a follow-up PR — see plan Risks),
 * `zoneForBpm` falls back to a hard-coded default of 190 bpm.
 */
export function RowMetricsCard({
  strokeCount,
  cadenceSpm,
  paceSecondsPer500m,
  elapsedSeconds,
  lapElapsedSeconds = null,
  heartRateBpm = null,
}: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("row");
  const formatters = useFormatters();

  // `paceSecondsPer500m` is what our pace-from-cadence estimator returns;
  // `formatPace` wants m/s. Invert here so the existing formatter keeps
  // its single-arg shape and we don't duplicate locale logic. Infinity
  // pace -> 0 m/s -> em-dash via formatPace's own guard.
  const boatSpeedMpsForFormatter =
    paceSecondsPer500m > 0 && Number.isFinite(paceSecondsPer500m)
      ? 500 / paceSecondsPer500m
      : 0;

  const totalTimeString = formatters.duration(elapsedSeconds, {
    tenths: false,
  });
  const lapTimeString =
    lapElapsedSeconds != null
      ? formatters.duration(lapElapsedSeconds, { tenths: false })
      : null;

  const cadenceString =
    cadenceSpm > 0
      ? `${Math.round(cadenceSpm)} ${t("metrics.cadenceUnit")}`
      : "—";

  const heartRateZone = zoneForBpm(heartRateBpm);
  const heartRateString =
    heartRateBpm != null
      ? `${Math.round(heartRateBpm)} ${t("metrics.heartRateUnit")}`
      : null;

  return (
    <Card variant="elevated" padding="md" style={styles.card}>
      <Stat
        label={t("metrics.cadence")}
        value={cadenceString}
        emphasis="primary"
      />
      <Stat label={t("metrics.strokes")} value={strokeCount.toString()} />
      <Stat
        label={t("metrics.pace")}
        value={formatters.pace(boatSpeedMpsForFormatter)}
      />
      <StatRow
        left={<Stat label={t("metrics.totalTime")} value={totalTimeString} />}
        right={
          lapTimeString != null ? (
            <Stat label={t("metrics.lapTime")} value={lapTimeString} />
          ) : null
        }
      />
      {heartRateString ? (
        <Stat
          label={t("metrics.heartRate")}
          value={heartRateString}
          accent={
            heartRateZone ? tokens.hrZones[heartRateZone].text : undefined
          }
          trailing={heartRateZone ? <ZonePill zone={heartRateZone} /> : null}
        />
      ) : null}
    </Card>
  );
}

/**
 * Two-column row helper for the metrics card. When `right` is null the
 * row collapses to a single full-width stat (which renders identically
 * to placing the `left` Stat directly in the card). When `right` is
 * provided, the two cells share the row 50/50 with the design system's
 * standard spacing. Each cell is `flex: 1` so the Stat's
 * `adjustsFontSizeToFit` can downscale the numeric value if a narrow
 * column would otherwise truncate it.
 */
function StatRow({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode | null;
}) {
  if (right == null) {
    return <>{left}</>;
  }
  return (
    <View style={styles.statRow}>
      <View style={styles.statRowCell}>{left}</View>
      <View style={styles.statRowCell}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  statRow: {
    flexDirection: "row",
    gap: 14,
  },
  statRowCell: {
    flex: 1,
  },
});
