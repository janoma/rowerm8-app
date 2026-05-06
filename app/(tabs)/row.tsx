import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LiveAccelerationCard } from "@/components/sensor/live-acceleration-card";
import { SensorPickerSheet } from "@/components/sensor/sensor-picker-sheet";
import { SensorPlacementModal } from "@/components/sensor/sensor-placement-modal";
import { SensorStatusCard } from "@/components/sensor/sensor-status-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PLACEMENT_DONT_SHOW_KEY } from "@/constants/storage-keys";
import { useBle } from "@/contexts/ble-context";
import {
  type MotionSensorSource,
  useMotionSensor,
} from "@/contexts/motion-sensor-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMotionStream } from "@/hooks/use-motion-stream";

const COLORS = {
  light: {
    helper: "#687076",
    placeholderBorder: "#D1D5DA",
    placeholderText: "#9BA1A6",
    primaryBg: "#0a7ea4",
    primaryText: "#FFFFFF",
    permissionBg: "rgba(224, 138, 30, 0.12)",
    permissionBorder: "rgba(224, 138, 30, 0.4)",
    permissionText: "#9C5E0E",
  },
  dark: {
    helper: "#9BA1A6",
    placeholderBorder: "#2F3236",
    placeholderText: "#6E7174",
    primaryBg: "#0a7ea4",
    primaryText: "#FFFFFF",
    permissionBg: "rgba(255, 176, 32, 0.14)",
    permissionBorder: "rgba(255, 176, 32, 0.45)",
    permissionText: "#FFB020",
  },
} as const;

export default function RowScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const { source, deviceLabel, selectPhone, clear } = useMotionSensor();
  const stream = useMotionStream();
  const ble = useBle();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placementVisible, setPlacementVisible] = useState(false);
  const prevSource = useRef<MotionSensorSource>(source);

  useEffect(() => {
    const prev = prevSource.current;
    prevSource.current = source;
    if (prev !== "none" || (source !== "phone" && source !== "ble")) {
      return;
    }
    AsyncStorage.getItem(PLACEMENT_DONT_SHOW_KEY).then((v) => {
      if (v !== "true") {
        setPlacementVisible(true);
      }
    });
  }, [source]);

  const handlePlacementDismiss = useCallback((dontShowAgain: boolean) => {
    setPlacementVisible(false);
    if (dontShowAgain) {
      AsyncStorage.setItem(PLACEMENT_DONT_SHOW_KEY, "true").catch(() => {});
    }
  }, []);

  // "Connected" means data is actually flowing right now, not just that a source
  // has been persisted. After cold start the persisted selection hydrates
  // immediately, but the BLE link has to be re-established from scratch — so we
  // need this distinction to avoid showing a green check next to an inactive
  // device.
  const connected =
    (source === "phone" && stream.isAvailable && !stream.permissionDenied) ||
    (source === "ble" && !!ble.activeDevice && stream.hasDecoder);

  useEffect(() => {
    if (source !== "ble" && ble.activeDevice) {
      ble.disconnect();
    }
  }, [source, ble]);

  const renderDataSection = () => {
    if (source === "none") {
      return (
        <View
          style={[
            styles.placeholder,
            { borderColor: palette.placeholderBorder },
          ]}
          accessibilityElementsHidden
        >
          <ThemedText
            style={[styles.placeholderText, { color: palette.placeholderText }]}
          >
            Live sensor data will appear here once you select a source.
          </ThemedText>
        </View>
      );
    }

    if (source === "phone") {
      if (stream.permissionDenied) {
        return (
          <Notice palette={palette}>
            Motion permission was denied. Enable Motion &amp; Fitness for
            rowerm8 in Settings to see live data.
          </Notice>
        );
      }
      if (!stream.isAvailable) {
        return (
          <Notice palette={palette}>
            No accelerometer detected on this device.
          </Notice>
        );
      }
      return (
        <LiveAccelerationCard
          sample={stream.sample}
          histories={stream.histories}
          sampleRateHz={stream.sampleRateHz}
        />
      );
    }

    if (!ble.activeDevice) {
      return (
        <Notice palette={palette}>
          Tap Connect to reconnect to {deviceLabel ?? "your Bluetooth sensor"}.
        </Notice>
      );
    }

    if (!stream.hasDecoder) {
      return (
        <Notice palette={palette}>
          Connected to {deviceLabel ?? "this device"}, but rowerm8 doesn&apos;t
          have a decoder for it yet. Live data is unavailable.
        </Notice>
      );
    }

    if (!stream.isAvailable) {
      return (
        <Notice palette={palette}>
          Connecting to {deviceLabel ?? "sensor"}...
        </Notice>
      );
    }

    return (
      <LiveAccelerationCard
        sample={stream.sample}
        histories={stream.histories}
        sampleRateHz={stream.sampleRateHz}
      />
    );
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Row
          </ThemedText>

          <SensorStatusCard
            selected={source !== "none"}
            connected={connected}
            deviceLabel={deviceLabel}
            batteryPercent={source === "ble" ? ble.batteryPercent : null}
            onPressAction={() => setPickerOpen(true)}
          />

          {source === "none" ? (
            <>
              <Pressable
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Select motion sensor"
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: palette.primaryBg,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <IconSymbol
                  name="dot.radiowaves.left.and.right"
                  size={20}
                  color={palette.primaryText}
                />
                <ThemedText
                  style={[
                    styles.primaryButtonText,
                    { color: palette.primaryText },
                  ]}
                >
                  Select motion sensor
                </ThemedText>
              </Pressable>
              <ThemedText style={[styles.helper, { color: palette.helper }]}>
                Choose how you want to track stroke motion.
              </ThemedText>
            </>
          ) : null}

          {renderDataSection()}
        </View>
      </SafeAreaView>

      <SensorPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectPhone={selectPhone}
        onDisconnect={source !== "none" ? clear : undefined}
      />

      {source !== "none" && (
        <SensorPlacementModal
          visible={placementVisible}
          onDismiss={handlePlacementDismiss}
          source={source}
        />
      )}
    </ThemedView>
  );
}

function Notice({
  palette,
  children,
}: {
  palette: (typeof COLORS)[keyof typeof COLORS];
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.notice,
        {
          backgroundColor: palette.permissionBg,
          borderColor: palette.permissionBorder,
        },
      ]}
    >
      <ThemedText
        style={[styles.noticeText, { color: palette.permissionText }]}
      >
        {children}
      </ThemedText>
    </View>
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
    gap: 18,
  },
  title: {
    marginBottom: 4,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  helper: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: -6,
  },
  placeholder: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 18,
  },
});
