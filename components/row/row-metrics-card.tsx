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
  },
  dark: {
    surface: "#1F2224",
    surfaceBorder: "#2A2D30",
    label: "#9BA1A6",
    value: "#ECEDEE",
    accent: "#3DB7E0",
  },
} as const;

const monoFont = Fonts.mono;

type Props = {
  strokeCount: number;
  cadenceSpm: number;
  paceSecondsPer500m: number;
  elapsedSeconds: number;
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
      ? `${cadenceSpm.toFixed(1)} ${t("metrics.cadenceUnit")}`
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
      <View style={styles.row}>
        <Metric
          label={t("metrics.strokes")}
          value={strokeCount.toString()}
          palette={palette}
          big
        />
        <Metric
          label={t("metrics.cadence")}
          value={cadenceString}
          palette={palette}
          big
        />
      </View>
      <View style={styles.row}>
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
      </View>
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
  big,
}: {
  label: string;
  value: string;
  palette: (typeof COLORS)[keyof typeof COLORS];
  big?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <ThemedText style={[styles.metricLabel, { color: palette.label }]}>
        {label}
      </ThemedText>
      <ThemedText
        style={[
          big ? styles.metricValueBig : styles.metricValue,
          { color: palette.value, fontFamily: monoFont },
        ]}
        numberOfLines={1}
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
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  metric: {
    flex: 1,
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricValueBig: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
  },
  footer: {
    fontSize: 12,
    lineHeight: 14,
  },
});
