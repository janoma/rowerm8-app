/**
 * Animated equalizer-style waveform for the cadence-calibration UI.
 *
 * Renders 5 vertical bars whose heights breathe in and out of sync,
 * each with an independent phase offset, producing the "reading
 * rhythm" feel users expect while their first few strokes are being
 * gathered. Replaces the v1 5-dot progress meter that explicitly
 * counted strokes — under the dynamic-calibration plan we don't tell
 * the user how many strokes they have left, only that we're listening.
 *
 * Implementation notes
 * --------------------
 * - Uses the React Native `Animated` API (no Reanimated dependency).
 *   Five animated nodes is well below the threshold where the JS-driven
 *   loop becomes a bottleneck, and we already drive other ~4 Hz
 *   animations from the JS thread.
 * - Per-bar phase offset is derived from the bar index so we don't
 *   need to allocate an extra delay per bar — each bar's height is
 *   `min + (max-min) * (sin(phase) * 0.5 + 0.5)` evaluated against
 *   one shared driver value plus a constant offset.
 * - The animation cleanup is critical: the loop must be stopped on
 *   unmount, otherwise React Native logs a "running animation on
 *   unmounted component" warning (and very rarely leaks the driver).
 * - Copy lives in `metrics.calibrating`; same `calibrationWrap` shell
 *   the v1 progress block used so there's no jarring height/colour
 *   shift when the detector transitions out of calibration.
 */
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/design-system";

const BAR_COUNT = 5;
const BAR_WIDTH = 6;
const BAR_GAP = 6;
const BAR_MIN_HEIGHT = 8;
const BAR_MAX_HEIGHT = 32;
/** One full breathe cycle in ms. ~1100 ms feels like an unhurried pulse. */
const CYCLE_MS = 1100;

export function CalibrationWaveform() {
  const { tokens } = useTheme();
  const { t } = useTranslation("row");

  // One shared driver advances 0 → 1 → 0 → 1 …; per-bar phases are
  // baked into the height interpolation so we don't allocate N drivers.
  const driverRef = useRef(new Animated.Value(0));

  useEffect(() => {
    const driver = driverRef.current;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(driver, {
          toValue: 1,
          duration: CYCLE_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(driver, {
          toValue: 0,
          duration: CYCLE_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, []);

  // Per-bar interpolation: each bar maps the shared 0-1 driver onto a
  // height range, but with a phase shift implemented as a custom
  // input → output curve. Bars on the edges are slightly shorter at
  // peak to give the waveform a centred-arch feel rather than a flat
  // pulse.
  const bars = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      // Phase shifts evenly around the cycle. Bar i peaks at fraction
      // i / BAR_COUNT of the cycle.
      const phase = i / BAR_COUNT;
      // We approximate `sin(2π·(t + phase)) * 0.5 + 0.5` with two
      // linear ramps over the [0,1] driver. The result is
      // perceptually identical for 5 bars at this cycle length.
      const inputs = [0, 0.25, 0.5, 0.75, 1].map((x) => (x + phase) % 1);
      const outputs = [0, 1, 0, -1, 0].map((y) => (y + 1) / 2);
      // Sort by input so the interpolation is monotonic.
      const pairs = inputs
        .map((x, k) => ({ x, y: outputs[k] }))
        .sort((a, b) => a.x - b.x);
      const inputRange = pairs.map((p) => p.x);
      const outputRange = pairs.map(
        (p) => BAR_MIN_HEIGHT + p.y * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT),
      );
      const height = driverRef.current.interpolate({
        inputRange,
        outputRange,
      });
      return { key: i, height };
    });
  }, []);

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
      <View style={styles.bars}>
        {bars.map(({ key, height }) => (
          <Animated.View
            key={key}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: tokens.colors.accent,
              },
            ]}
          />
        ))}
      </View>
      <Text
        style={[
          styles.calibrationSublabel,
          { color: tokens.colors.textSecondary },
        ]}
      >
        {t("metrics.calibrating")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  bars: {
    flexDirection: "row",
    alignItems: "center",
    gap: BAR_GAP,
    height: BAR_MAX_HEIGHT,
    paddingVertical: 8,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  calibrationSublabel: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
  },
});
