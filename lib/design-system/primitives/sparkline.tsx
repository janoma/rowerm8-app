/**
 * Sparkline — tiny "bar sparkline" rendered with vanilla View
 * primitives.
 *
 * Originally written for the activity-detail charts; promoted to
 * `lib/design-system/primitives/` so any future chart surface can
 * reuse it without depending on the activity feature.
 *
 * No SVG / charting library: rowing detail charts only need to
 * communicate shape (cadence climbed, HR plateaued) and a
 * vertical-bars sparkline does that well at small sizes with zero
 * native deps.
 *
 * Behaviour:
 *   - Pass `values` already downsampled to your desired bar count
 *     (use `downsampleMean` from lib/activity/fit-reader).
 *   - `null` entries render as gaps so HR pre-pickup or paused
 *     samples don't artificially anchor the chart at zero.
 *   - The y-axis is auto-scaled to the [min, max] of the non-null
 *     values, with a small padding so flat data still produces
 *     visible bars.
 *   - `color` and `trackColor` default to the design-system `chart`
 *     tokens (`chart.cadence` and `chart.track`). Override per-call
 *     for HR (use `tokens.chart.heart`).
 */

import { StyleSheet, View } from "react-native";

import { useTheme } from "../provider";

export type SparklineProps = {
  values: (number | null)[];
  /** Total chart height in dp. Bars stretch from the baseline to this height. */
  height: number;
  /** Bar fill color. Defaults to `tokens.chart.cadence`. */
  color?: string;
  /** Optional gap fill (low-emphasis baseline track). Defaults to `tokens.chart.track`. */
  trackColor?: string;
};

export function Sparkline({
  values,
  height,
  color,
  trackColor,
}: SparklineProps) {
  const { tokens } = useTheme();
  const barColor = color ?? tokens.chart.cadence;
  const trackFill = trackColor ?? tokens.chart.track;

  if (values.length === 0) {
    return <View style={[styles.root, { height }]} />;
  }

  const finite = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (finite.length === 0) {
    return <View style={[styles.root, { height }]} />;
  }

  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    // Flat data: pad the range so the bars are still visible (~half height).
    min -= 1;
    max += 1;
  }
  const range = max - min;

  return (
    <View style={[styles.root, { height }]} accessibilityRole="image">
      {values.map((v, idx) => {
        const isNull = v == null || !Number.isFinite(v);
        // Leave a 4 px floor so a "minimum" reading still draws a bar
        // (otherwise it'd be 0 px tall and visually disappear).
        const ratio = isNull ? 0 : Math.max(0.04, (v - min) / range);
        const barHeight = isNull ? 0 : Math.max(2, Math.round(ratio * height));
        return (
          <View key={idx} style={styles.column}>
            <View
              style={[styles.track, { backgroundColor: trackFill, height }]}
            />
            {!isNull ? (
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: barColor,
                    height: barHeight,
                  },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    overflow: "hidden",
  },
  column: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "stretch",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 1,
    opacity: 0.3,
  },
  bar: {
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
});
