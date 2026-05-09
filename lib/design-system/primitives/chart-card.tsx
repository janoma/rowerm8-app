/**
 * ChartCard — title + subtitle + sparkline, wrapped in a Card.
 *
 * Absorbs the inline `ChartCard` helper from
 * `app/activity/[id].tsx`. The optional `metric` prop selects the
 * right `chart.*` token automatically:
 *
 *   - `metric="cadence"` — accent teal bar + accent track.
 *   - `metric="heart"`   — Z5 red bar (matches the live HR pill).
 *
 * For one-off colors pass `barColor` / `trackColor` directly.
 */

import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../provider";
import { Card } from "./card";
import { Sparkline } from "./sparkline";

export type ChartMetric = "cadence" | "heart";

export type ChartCardProps = {
  title: string;
  subtitle?: string;
  values: (number | null)[];
  /** Pick a built-in metric color. Defaults to `"cadence"`. */
  metric?: ChartMetric;
  /** Override the bar color (wins over `metric`). */
  barColor?: string;
  /** Override the track color (wins over `metric`). */
  trackColor?: string;
  /** Sparkline height in dp. Defaults to 64. */
  height?: number;
};

export function ChartCard({
  title,
  subtitle,
  values,
  metric = "cadence",
  barColor,
  trackColor,
  height = 64,
}: ChartCardProps) {
  const { tokens } = useTheme();
  const resolvedBar =
    barColor ??
    (metric === "heart" ? tokens.chart.heart : tokens.chart.cadence);
  const resolvedTrack = trackColor ?? tokens.chart.track;

  return (
    <Card variant="elevated" padding="md">
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: tokens.colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Sparkline
        values={values}
        height={height}
        color={resolvedBar}
        trackColor={resolvedTrack}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 17,
  },
});
