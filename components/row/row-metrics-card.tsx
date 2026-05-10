import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useFormatters } from "@/lib/format";
import { Card, Stat, ZonePill, useTheme } from "@/lib/design-system";
import { zoneForBpm } from "@/lib/hr/zones";

/**
 * Number of strokes the user must produce after motion data starts
 * flowing before the cadence detector is considered calibrated. Below
 * this count we either show the "0 + helper line" pre-stroke layout
 * (count = 0) or the progress dots (1..N-1); at or above this count
 * we render the live cadence value. The Start button in
 * `app/free-row.tsx` is also gated on this same threshold, which is
 * why the constant is exported.
 */
export const CALIBRATION_STROKE_COUNT = 5;

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
   * Number of strokes the session has counted toward calibration, or
   * `null` once recording has started (signals "cadence is live, skip
   * the calibration UX entirely"). When `0`, the cadence block shows
   * `0 spm` plus a helper line below the card asking the user to start
   * rowing. When `1..CALIBRATION_STROKE_COUNT-1`, the cadence block is
   * replaced with the 5-dot progress meter (Option D from the
   * row-fixes plan). When `>= CALIBRATION_STROKE_COUNT`, the live
   * cadence is shown — at which point `app/free-row.tsx` will enable
   * the Start button.
   */
  calibrationStrokeCount?: number | null;
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
 *
 * `calibrationStrokeCount` gates the cadence block through three
 * states (pre-stroke / calibrating / calibrated). See the prop
 * docstring for the precise mapping.
 */
export function RowMetricsCard({
  strokeCount,
  cadenceSpm,
  paceSecondsPer500m,
  elapsedSeconds,
  lapElapsedSeconds = null,
  heartRateBpm = null,
  calibrationStrokeCount = null,
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

  const heartRateZone = zoneForBpm(heartRateBpm);
  const heartRateString =
    heartRateBpm != null
      ? `${Math.round(heartRateBpm)} ${t("metrics.heartRateUnit")}`
      : null;

  // The cadence block has three possible renderings depending on the
  // calibration state; everything else in the card is unchanged.
  // Pre-stroke (0) and post-calibration (>= N) both render a standard
  // primary `<Stat>`; only the calibrating window (1..N-1) swaps in a
  // bespoke progress block. We compute the value string here so the
  // pre-stroke "0 spm" branch and the post-calibration "live" branch
  // share the same code path.
  const isCalibrating =
    calibrationStrokeCount != null &&
    calibrationStrokeCount > 0 &&
    calibrationStrokeCount < CALIBRATION_STROKE_COUNT;
  const showCadenceZero = calibrationStrokeCount === 0;

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
          <CalibrationProgressBlock count={calibrationStrokeCount!} />
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
 * Option D from the row-fixes plan: a 5-dot progress meter that
 * occupies the primary cadence slot while the detector is collecting
 * its first {@link CALIBRATION_STROKE_COUNT} strokes. Filled dots are
 * tinted with the accent color; unfilled dots are outlined in the
 * secondary text color. The sublabel below the dots reads
 * "{count} of {total} calibration strokes". The outer wrapper styles
 * mirror `<Stat emphasis="primary">` so the calibration block has the
 * same visual weight as the live cadence display it replaces — there's
 * no jarring height/colour shift when the detector transitions out of
 * calibration.
 */
function CalibrationProgressBlock({ count }: { count: number }) {
  const { tokens } = useTheme();
  const { t } = useTranslation("row");
  const total = CALIBRATION_STROKE_COUNT;
  const filled = Math.max(0, Math.min(count, total));

  return (
    <View
      style={[
        styles.calibrationWrap,
        {
          backgroundColor: tokens.colors.accentSubtle,
          borderColor: tokens.colors.accentSubtleBorder,
          borderRadius: tokens.radius.md,
        },
      ]}
    >
      <Text
        style={[styles.calibrationLabel, { color: tokens.colors.accentText }]}
      >
        {t("metrics.cadence")}
      </Text>
      <View style={styles.calibrationDots}>
        {Array.from({ length: total }, (_, i) => {
          const isFilled = i < filled;
          return (
            <View
              key={i}
              style={[
                styles.calibrationDot,
                isFilled
                  ? { backgroundColor: tokens.colors.accent }
                  : {
                      backgroundColor: "transparent",
                      borderWidth: 2,
                      borderColor: tokens.colors.border,
                    },
              ]}
            />
          );
        })}
      </View>
      <Text
        style={[
          styles.calibrationSublabel,
          { color: tokens.colors.textSecondary },
        ]}
      >
        {t("metrics.calibrationProgress", { count, total })}
      </Text>
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
  // Matches `Stat`'s primaryWrap so the calibration block has the same
  // outer geometry as the live cadence Stat it replaces.
  calibrationWrap: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    alignItems: "center",
  },
  calibrationLabel: {
    alignSelf: "stretch",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  calibrationDots: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 8,
  },
  calibrationDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  calibrationSublabel: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
  },
  calibrateHelper: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
