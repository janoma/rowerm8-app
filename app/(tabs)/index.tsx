import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SensorPickerSheet } from "@/components/sensor/sensor-picker-sheet";
import { SensorPlacementModal } from "@/components/sensor/sensor-placement-modal";
import { SensorStatusCard } from "@/components/sensor/sensor-status-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { PLACEMENT_DONT_SHOW_KEY } from "@/constants/storage-keys";
import { useBle } from "@/contexts/ble-context";
import { useHeartRate } from "@/contexts/heart-rate-context";
import {
  type MotionSensorSource,
  useMotionSensor,
} from "@/contexts/motion-sensor-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHeartRateStream } from "@/hooks/use-heart-rate-stream";
import { useMotionStream } from "@/hooks/use-motion-stream";

const COLORS = {
  light: {
    helper: "#687076",
    sectionLabel: "#687076",
  },
  dark: {
    helper: "#9BA1A6",
    sectionLabel: "#9BA1A6",
  },
} as const;

export default function HomeScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const { t } = useTranslation("home");
  const { t: tSensor } = useTranslation("sensor");
  const { t: tRow } = useTranslation("row");

  const motion = useMotionSensor();
  const heartRate = useHeartRate();
  const ble = useBle();
  const motionStream = useMotionStream();
  const heartRateStream = useHeartRateStream();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [placementVisible, setPlacementVisible] = useState(false);
  const prevMotionSource = useRef<MotionSensorSource>(motion.source);

  // Show the placement onboarding once when the user first picks any motion
  // source. We watch a "none → phone/ble" transition so the modal doesn't
  // re-trigger every time the user changes between Phone and BLE.
  useEffect(() => {
    const prev = prevMotionSource.current;
    prevMotionSource.current = motion.source;
    if (
      prev !== "none" ||
      (motion.source !== "phone" && motion.source !== "ble")
    ) {
      return;
    }
    AsyncStorage.getItem(PLACEMENT_DONT_SHOW_KEY).then((v) => {
      if (v !== "true") {
        setPlacementVisible(true);
      }
    });
  }, [motion.source]);

  const handlePlacementDismiss = useCallback((dontShowAgain: boolean) => {
    setPlacementVisible(false);
    if (dontShowAgain) {
      AsyncStorage.setItem(PLACEMENT_DONT_SHOW_KEY, "true").catch(() => {});
    }
  }, []);

  // The persisted selection can drift from the live BLE state when the user
  // switches motion source from BLE to phone, or clears it. Tear down the
  // motion connection any time the selection no longer points to BLE so we
  // don't keep pulling notifications from a sensor the user has dropped.
  useEffect(() => {
    if (motion.source !== "ble" && ble.motion.activeDevice) {
      ble.disconnect("motion");
    }
  }, [motion.source, ble]);

  // HR has only one valid source ("ble"), so the symmetry is simpler — just
  // disconnect when the user clears.
  useEffect(() => {
    if (heartRate.source !== "ble" && ble.hr.activeDevice) {
      ble.disconnect("hr");
    }
  }, [heartRate.source, ble]);

  const motionConnected =
    (motion.source === "phone" &&
      motionStream.isAvailable &&
      !motionStream.permissionDenied) ||
    (motion.source === "ble" &&
      !!ble.motion.activeDevice &&
      motionStream.hasDecoder);

  const motionDeviceLabel =
    motion.source === "phone"
      ? tRow("phone.label")
      : (motion.deviceLabel ?? null);

  const heartRateConnected =
    heartRate.source === "ble" && !!ble.hr.activeDevice;

  const heartRateLiveValue =
    heartRateConnected && heartRateStream.bpm != null
      ? tSensor("status.hr.live", { bpm: heartRateStream.bpm })
      : null;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.title}>
            {t("title")}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: palette.helper }]}>
            {t("subtitle")}
          </ThemedText>

          <ThemedText
            style={[styles.sectionLabel, { color: palette.sectionLabel }]}
          >
            {t("devices.header")}
          </ThemedText>

          <SensorStatusCard
            kind="motion"
            selected={motion.source !== "none"}
            connected={motionConnected}
            deviceLabel={motionDeviceLabel}
            batteryPercent={
              motion.source === "ble" ? ble.motion.batteryPercent : null
            }
            onPressAction={() => setPickerOpen(true)}
          />

          <SensorStatusCard
            kind="hr"
            selected={heartRate.source === "ble"}
            connected={heartRateConnected}
            deviceLabel={
              heartRate.source === "ble" ? heartRate.deviceLabel : null
            }
            batteryPercent={
              heartRate.source === "ble" ? ble.hr.batteryPercent : null
            }
            liveValue={heartRateLiveValue}
            // HR has only one valid source (BLE), so both Connect and Change
            // jump straight to the role-filtered scan; no picker sheet needed.
            onPressAction={() => router.push("/ble-scan?role=hr")}
          />

          <ThemedText style={[styles.helper, { color: palette.helper }]}>
            {t("devices.helper")}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <SensorPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectPhone={motion.selectPhone}
        onDisconnect={motion.source !== "none" ? motion.clear : undefined}
      />

      {motion.source !== "none" ? (
        <SensorPlacementModal
          visible={placementVisible}
          onDismiss={handlePlacementDismiss}
          source={motion.source}
        />
      ) : null}
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginTop: 6,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
