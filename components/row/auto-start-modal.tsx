/**
 * Auto-start countdown modal for the Free-row screen.
 *
 * Surfaces when the stroke detector picks up rowing motion before the
 * user taps Start. A determinate progress bar fills over `durationMs`
 * (default 5s); on completion we call `onComplete()`, which the parent
 * wires to its existing `handleStart()`. A Cancel button below lets
 * the user opt out of this round (the parent suppresses the modal
 * for the rest of the armed session).
 *
 * Visual model mirrors the existing `SensorPlacementModal` — fade-in
 * `Modal` with a centered card on a dimmed backdrop. Colors come from
 * `useTheme()` so light / dark mode both look correct without us
 * shipping a parallel palette.
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button, useTheme } from "@/lib/design-system";

type Props = {
  visible: boolean;
  onCancel: () => void;
  onComplete: () => void;
  /**
   * Total fill duration in milliseconds. Defaults to 5000 — the value
   * Free row passes today and what the docs call out. Lower values are
   * useful for tests / Storybook snapshots.
   */
  durationMs?: number;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_MAX_WIDTH = 360;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, CARD_MAX_WIDTH);

export function AutoStartModal({
  visible,
  onCancel,
  onComplete,
  durationMs = 5000,
}: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("row");

  // Drive the bar fill 0 → 1 over `durationMs` whenever the modal
  // becomes visible. Width can't use the native driver (it animates
  // a layout property), so the JS-driven loop is fine for ~60 fps
  // over 5 s.
  const progressRef = useRef(new Animated.Value(0));

  // Capture `onComplete` in a ref so the effect doesn't re-run when
  // the parent recreates the callback. `useEffect` only re-runs on
  // `visible` / `durationMs` changes — which is exactly what we want
  // (the animation should restart only when we re-open the modal).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const driver = progressRef.current;
    if (!visible) {
      driver.stopAnimation();
      driver.setValue(0);
      return;
    }
    driver.setValue(0);
    const animation = Animated.timing(driver, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      // `finished` is false when the animation is stopped (e.g. via
      // the !visible branch above on Cancel). Only fire onComplete
      // when the timer actually ran out.
      if (finished) {
        onCompleteRef.current();
      }
    });
    return () => {
      animation.stop();
    };
  }, [visible, durationMs]);

  const widthInterp = progressRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View
        style={[styles.backdrop, { backgroundColor: tokens.colors.overlay }]}
      >
        <View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              backgroundColor: tokens.colors.surface,
              borderRadius: tokens.radius.xl,
              borderColor: tokens.colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: tokens.colors.text }]}>
            {t("freeRow.autoStart.title")}
          </Text>

          <View
            style={[
              styles.progressTrack,
              { backgroundColor: tokens.colors.accentSubtle },
            ]}
            accessibilityRole="progressbar"
            accessibilityLabel={t("freeRow.autoStart.a11yProgress")}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: widthInterp,
                  backgroundColor: tokens.colors.accent,
                },
              ]}
            />
          </View>

          <Button
            title={t("freeRow.autoStart.cancel")}
            onPress={onCancel}
            tone="neutral"
            variant="tinted"
            size="md"
            block
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 22,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
});
