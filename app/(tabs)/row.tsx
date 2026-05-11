import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useBle } from "@/contexts/ble-context";
import { useHeartRate } from "@/contexts/heart-rate-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { useMotionStream } from "@/hooks/use-motion-stream";
import {
  Banner,
  LauncherCard,
  Stack,
  StatusPill,
  useTheme,
} from "@/lib/design-system";

export default function RowScreen() {
  const { tokens } = useTheme();
  const { t } = useTranslation("row");
  const { source, deviceLabel: rawDeviceLabel } = useMotionSensor();
  const heartRate = useHeartRate();
  const stream = useMotionStream();
  const ble = useBle();

  const motionReady =
    (source === "phone" && stream.isAvailable && !stream.permissionDenied) ||
    (source === "ble" && !!ble.motion.activeDevice && stream.hasDecoder);

  const motionDeviceLabel =
    source === "phone" ? t("phone.label") : (rawDeviceLabel ?? null);

  // HR only ever flows over BLE today, so "connected" is equivalent to
  // "we have a live BLE link". The device label is whatever was persisted
  // when the user picked the monitor on Home (falls back to a generic
  // string so the pill doesn't read "Heart rate: ").
  const hrReady = heartRate.source === "ble" && !!ble.hr.activeDevice;
  const hrLabel = heartRate.deviceLabel ?? "";

  const handleFreeRow = () => {
    router.push("/free-row");
  };

  const handleWorkout = () => {
    Alert.alert(t("workout.comingSoonTitle"), t("workout.comingSoonBody"));
  };

  const handleGoHome = () => {
    // Tabs are anchored at "/" so this jumps to the Home tab without
    // pushing a new stack entry.
    router.navigate("/");
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            {t("title")}
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: tokens.colors.textSecondary }]}
          >
            {t("launcher.subtitle")}
          </ThemedText>

          {motionReady ? (
            <View style={styles.statusPills}>
              <StatusPill tone="success" icon="dot.radiowaves.left.and.right">
                {t("launcher.readyMotion", { label: motionDeviceLabel ?? "" })}
              </StatusPill>
              {hrReady ? (
                <StatusPill tone="success" icon="heart.fill">
                  {t("launcher.readyHr", { label: hrLabel })}
                </StatusPill>
              ) : null}
            </View>
          ) : (
            <Banner
              tone="warning"
              action={{
                label: t("launcher.goHome"),
                onPress: handleGoHome,
                accessibilityLabel: t("launcher.a11yGoHome"),
              }}
            >
              {t("launcher.notReady")}
            </Banner>
          )}

          <Stack gap="sm">
            <LauncherCard
              tone="accent"
              iconName="play.fill"
              title={t("launcher.freeRow.title")}
              subtitle={t("launcher.freeRow.subtitle")}
              disabled={!motionReady}
              onPress={handleFreeRow}
              accessibilityLabel={t("launcher.freeRow.a11y")}
            />
            <LauncherCard
              tone="neutral"
              iconName="list.bullet"
              title={t("launcher.workout.title")}
              subtitle={t("launcher.workout.subtitle")}
              onPress={handleWorkout}
              accessibilityLabel={t("launcher.workout.a11y")}
            />
          </Stack>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  title: {
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  // Stack of "Motion: …" / "Heart rate: …" pills. The pills already
  // `alignSelf: flex-start`, so a column with a small gap is all the
  // grouping we need — without bunching against the parent's 14 px gap.
  statusPills: {
    gap: 6,
  },
});
