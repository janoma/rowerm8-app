import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { CalibrationWaveform } from "@/components/row/calibration-waveform";
import { ThemedText } from "@/components/themed-text";
import { useHrZoneResolver } from "@/hooks/use-hr-zone-resolver";
import { useFormatters } from "@/lib/format";
import { Card, Stat, ZonePill, useTheme } from "@/lib/design-system";
import type { CalibrationState } from "@/lib/stroke/calibration";

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
  /**
   * HR-derived cumulative calorie estimate, in kcal. Rendered in a
   * second column next to heart rate (using the same `<StatRow>` helper
   * as Total time / Lap time). When `null` the column collapses,
   * leaving the heart rate stat full-width. Setting this to `0` while
   * HR is non-null is fine — the integration just hasn't accrued a
   * round kcal yet — and the column will render `0 kcal` so the user
   * sees the field is alive.
   */
  caloriesKcal?: number | null;
  /**
   * Cadence-calibration state. When `null` the calibration UX is
   * skipped entirely (recording is in flight, cadence is live). When
   * `idle`, the cadence block shows `0 spm` plus the "start rowing to
   * calibrate" helper line. When `calibrating`, the cadence block is
   * replaced with the animated `<CalibrationWaveform>` so the user
   * sees the detector is listening without us telling them how many
   * strokes are left. When `calibrated`, live cadence is rendered —
   * at which point `app/free-row.tsx` will enable the Start button.
   */
  calibrationState?: CalibrationState | null;
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
 * the active zone-model's color (via `useHrZoneResolver()`) and a
 * small `<ZonePill>` is rendered beside it. The zone thresholds come
 * from the user's profile — `maxHrBpm` for the 5-zone Garmin/Polar
 * model, `thresholdHrBpm` for the 7-zone Coggan/Friel model. When
 * neither is set, the resolver falls back to the documented defaults.
 *
 * `calibrationState` gates the cadence block through three states
 * (idle / calibrating / calibrated). See the prop docstring for the
 * precise mapping.
 */
export function RowMetricsCard({
  strokeCount,
  cadenceSpm,
  paceSecondsPer500m,
  elapsedSeconds,
  lapElapsedSeconds = null,
  heartRateBpm = null,
  caloriesKcal = null,
  calibrationState = null,
}: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("row");
  const formatters = useFormatters();
  const zoneResolver = useHrZoneResolver();

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

  const heartRateZone = zoneResolver.resolve(heartRateBpm);
  const heartRateZoneTextColor = heartRateZone
    ? (zoneResolver.palette as Record<string, { text: string }>)[heartRateZone]
        .text
    : undefined;
  const heartRateString =
    heartRateBpm != null
      ? `${Math.round(heartRateBpm)} ${t("metrics.heartRateUnit")}`
      : null;
  const caloriesString =
    caloriesKcal != null && Number.isFinite(caloriesKcal)
      ? `${Math.round(Math.max(0, caloriesKcal))} ${t("metrics.caloriesUnit")}`
      : null;

  // The cadence block has three possible renderings depending on the
  // calibration state; everything else in the card is unchanged.
  //   idle         → "0 spm" + helper line below the card
  //   calibrating  → animated <CalibrationWaveform> in the cadence slot
  //   calibrated / null → live cadence in a primary <Stat>
  const isCalibrating = calibrationState === "calibrating";
  const showCadenceZero = calibrationState === "idle";

  let cadenceValueString: string;
  if (showCadenceZero) {
    cadenceValueString = `0 ${t("metrics.cadenceUnit")}`;
  } else if (cadenceSpm > 0) {
    cadenceValueString = `${Math.round(cadenceSpm)} ${t("metrics.cadenceUnit")}`;
  } else {
    cadenceValueString = "—";
  }

  return (
    <View style={styles.root}>
      <Card variant="elevated" padding="md" style={styles.card}>
        {isCalibrating ? (
          <CalibrationWaveform />
        ) : (
          <Stat
            label={t("metrics.cadence")}
            value={cadenceValueString}
            emphasis="primary"
          />
        )}
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
          <StatRow
            left={
              <Stat
                label={t("metrics.heartRate")}
                value={heartRateString}
                accent={heartRateZoneTextColor}
                trailing={
                  heartRateZone ? <ZonePill zone={heartRateZone} /> : null
                }
              />
            }
            right={
              caloriesString != null ? (
                <Stat label={t("metrics.calories")} value={caloriesString} />
              ) : null
            }
          />
        ) : null}
      </Card>
      {showCadenceZero ? (
        <ThemedText
          style={[
            styles.calibrateHelper,
            { color: tokens.colors.textSecondary },
          ]}
        >
          {t("metrics.calibrateHelper")}
        </ThemedText>
      ) : null}
    </View>
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
  root: {
    gap: 8,
  },
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
  calibrateHelper: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
