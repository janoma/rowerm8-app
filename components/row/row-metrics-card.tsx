import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFormatters } from "@/lib/format";

const COLORS = {
  light: {
    surface: "#F2F3F5",
    surfaceBorder: "#E4E6EA",
    label: "#687076",
    value: "#11181C",
    accent: "#0a7ea4",
    // Tinted background + matching label colour for the highlighted
    // primary metric. The tint is a faint wash of the accent so the
    // emphasis is unmistakable but the card doesn't read as "selected".
    primarySurface: "rgba(10, 126, 164, 0.10)",
    primarySurfaceBorder: "rgba(10, 126, 164, 0.28)",
    primaryLabel: "#075f7c",
  },
  dark: {
    surface: "#1F2224",
    surfaceBorder: "#2A2D30",
    label: "#9BA1A6",
    value: "#ECEDEE",
    accent: "#3DB7E0",
    primarySurface: "rgba(61, 183, 224, 0.14)",
    primarySurfaceBorder: "rgba(61, 183, 224, 0.36)",
    primaryLabel: "#7FD4EC",
  },
} as const;

const monoFont = Fonts.mono;

type Props = {
  strokeCount: number;
  cadenceSpm: number;
  paceSecondsPer500m: number;
  elapsedSeconds: number;
  /**
   * Live heart rate in bpm. Pass `null`/`undefined` when no HR source is
   * connected or the monitor hasn't reported a reading yet — the row is
   * hidden in that case so users without an HRM don't see a stale "—".
   */
  heartRateBpm?: number | null;
  /** Optional rate-of-data-arrival (Hz) to surface in the footer for
   * parity with the previous accelerometer card; pass 0 to hide. */
  sampleRateHz?: number;
};

/**
 * Glanceable rowing metrics: stroke count, cadence (smoothed), pace
 * estimate, and elapsed time. The cadence and elapsed values use the
 * existing app-wide formatters so locale-specific number / time formatting
 * stays consistent with the rest of the app. Pace is rendered through
 * `formatPace` and respects the user's pace-unit preference; before the
 * first stroke the boat speed is zero, so `formatPace` renders the em-dash
 * placeholder for us.
 */
export function RowMetricsCard({
  strokeCount,
  cadenceSpm,
  paceSecondsPer500m,
  elapsedSeconds,
  heartRateBpm = null,
  sampleRateHz = 0,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
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

  const elapsedString = formatters.duration(elapsedSeconds, {
    tenths: false,
  });

  const cadenceString =
    cadenceSpm > 0
      ? `${Math.round(cadenceSpm)} ${t("metrics.cadenceUnit")}`
      : "—";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
        },
      ]}
    >
      <View
        style={[
          styles.primaryMetric,
          {
            backgroundColor: palette.primarySurface,
            borderColor: palette.primarySurfaceBorder,
          },
        ]}
      >
        <ThemedText
          style={[styles.primaryLabel, { color: palette.primaryLabel }]}
        >
          {t("metrics.cadence")}
        </ThemedText>
        <ThemedText
          style={[
            styles.primaryValue,
            { color: palette.accent, fontFamily: monoFont },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {cadenceString}
        </ThemedText>
      </View>
      <Metric
        label={t("metrics.strokes")}
        value={strokeCount.toString()}
        palette={palette}
      />
      <Metric
        label={t("metrics.pace")}
        value={formatters.pace(boatSpeedMpsForFormatter)}
        palette={palette}
      />
      <Metric
        label={t("metrics.elapsed")}
        value={elapsedString}
        palette={palette}
      />
      {heartRateBpm != null ? (
        <Metric
          label={t("metrics.heartRate")}
          value={`${Math.round(heartRateBpm)} ${t("metrics.heartRateUnit")}`}
          palette={palette}
        />
      ) : null}
      {sampleRateHz > 0 ? (
        <ThemedText style={[styles.footer, { color: palette.label }]}>
          {t("metrics.footer", { rate: sampleRateHz })}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof COLORS)[keyof typeof COLORS];
}) {
  return (
    <View style={styles.metric}>
      <ThemedText style={[styles.metricLabel, { color: palette.label }]}>
        {label}
      </ThemedText>
      <ThemedText
        style={[
          styles.metricValue,
          { color: palette.value, fontFamily: monoFont },
        ]}
        numberOfLines={1}
        // adjustsFontSizeToFit + minimumFontScale lets the value shrink
        // gracefully on narrow screens (or with very long localized
        // strings) instead of clipping to "...". The full text remains
        // visible in normal cases since each metric now spans the entire
        // card width.
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  primaryMetric: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  primaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  primaryValue: {
    fontSize: 56,
    fontWeight: "800",
    lineHeight: 64,
  },
  metric: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
  },
  footer: {
    fontSize: 12,
    lineHeight: 14,
    marginTop: 4,
  },
});
