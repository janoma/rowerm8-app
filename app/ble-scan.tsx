import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DeviceCard } from "@/components/ble/device-card";
import { ScanHero } from "@/components/ble/scan-hero";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import type { ScannedDevice } from "@/contexts/ble-context";
import { useBle } from "@/contexts/ble-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    sectionLabel: "#687076",
    accent: "#0a7ea4",
    danger: "#D02E1F",
    border: "#E4E6EA",
    notice: "rgba(224, 138, 30, 0.12)",
    noticeBorder: "rgba(224, 138, 30, 0.4)",
    noticeText: "#9C5E0E",
  },
  dark: {
    sectionLabel: "#9BA1A6",
    accent: "#3DB7E0",
    danger: "#FF6369",
    border: "#2A2D30",
    notice: "rgba(255, 176, 32, 0.14)",
    noticeBorder: "rgba(255, 176, 32, 0.45)",
    noticeText: "#FFB020",
  },
} as const;

export default function BleScanScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const insets = useSafeAreaInsets();
  const ble = useBle();
  const { selectBle } = useMotionSensor();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const didAutoStartRef = useRef(false);
  const { availability, startScan, stopScan } = ble;

  // Devices we don't have a decoder for can't actually be used, so we hide
  // them entirely instead of cluttering the list.
  const supportedDevices = useMemo(
    () => ble.devices.filter((d) => d.decoder),
    [ble.devices],
  );

  useEffect(() => {
    if (availability === "on" && !didAutoStartRef.current) {
      didAutoStartRef.current = true;
      void startScan();
    }
  }, [availability, startScan]);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  const handlePressDevice = async (device: ScannedDevice) => {
    setPendingId(device.id);
    const connected = await ble.connect(device.id);
    setPendingId(null);
    if (connected) {
      const label =
        connected.name ??
        connected.localName ??
        `Bluetooth device ${connected.id.slice(-5)}`;
      selectBle({
        deviceLabel: label,
        bleDeviceId: connected.id,
        decoderKey: connected.decoder?.key ?? null,
      });
      router.dismiss();
    }
  };

  const close = () => {
    ble.stopScan();
    router.dismiss();
  };

  const heroTitle = (() => {
    if (ble.availability === "off") {
      return "Bluetooth is off";
    }
    if (ble.availability === "unauthorized") {
      return "Bluetooth permission needed";
    }
    if (ble.availability === "unavailable") {
      return "Bluetooth not available";
    }
    if (ble.availability === "unknown") {
      return "Initializing Bluetooth...";
    }
    if (ble.scanning) {
      return "Scanning for nearby sensors...";
    }
    return "Scan complete";
  })();

  const heroSubtitle = (() => {
    if (ble.availability === "off") {
      return "Turn on Bluetooth in Settings to continue.";
    }
    if (ble.availability === "unauthorized") {
      return "Enable Bluetooth for rowerm8 in iOS Settings.";
    }
    if (ble.availability === "unavailable") {
      return "This build does not include native Bluetooth support.";
    }
    if (ble.availability === "unknown") {
      return "Hang tight, this only takes a moment.";
    }
    if (ble.scanning) {
      return "Make sure your sensor is powered on and within 5 m";
    }
    return 'Tap "Scan again" to keep looking.';
  })();

  return (
    <ThemedView style={styles.root}>
      <View style={[styles.safeTop, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.navBar}>
          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <ThemedText style={[styles.navAction, { color: palette.accent }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.navTitle}>Bluetooth sensors</ThemedText>
          <View style={styles.navActionPlaceholder} />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <ScanHero
          scanning={ble.scanning && ble.availability === "on"}
          title={heroTitle}
          subtitle={heroSubtitle}
        />

        {ble.scanError ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: palette.notice,
                borderColor: palette.noticeBorder,
              },
            ]}
          >
            <ThemedText
              style={[styles.noticeText, { color: palette.noticeText }]}
            >
              {ble.scanError}
            </ThemedText>
          </View>
        ) : null}

        {ble.connectionError && pendingId === null ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: palette.notice,
                borderColor: palette.noticeBorder,
              },
            ]}
          >
            <ThemedText
              style={[styles.noticeText, { color: palette.noticeText }]}
            >
              Couldn&apos;t connect: {ble.connectionError}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <ThemedText
            style={[styles.sectionHeader, { color: palette.sectionLabel }]}
          >
            COMPATIBLE DEVICES ({supportedDevices.length})
          </ThemedText>
          {ble.scanning ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <Pressable
              onPress={() => ble.startScan()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Scan again"
            >
              <ThemedText style={[styles.scanAgain, { color: palette.accent }]}>
                Scan again
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.deviceList}>
          {supportedDevices.length === 0 && !ble.scanning ? (
            <ThemedText
              style={[styles.emptyText, { color: palette.sectionLabel }]}
            >
              No compatible sensors found yet. Make sure your sensor is on and
              try again.
            </ThemedText>
          ) : null}

          {supportedDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              busy={pendingId !== null && pendingId !== device.id}
              onPress={handlePressDevice}
            />
          ))}
        </View>

        {pendingId ? (
          <View style={styles.connectingFooter}>
            <ActivityIndicator size="small" color={palette.accent} />
            <ThemedText
              style={[styles.connectingText, { color: palette.accent }]}
            >
              Connecting...
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeTop: {
    paddingHorizontal: 16,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
  },
  navAction: {
    fontSize: 17,
    fontWeight: "500",
  },
  navActionPlaceholder: {
    width: 60,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.select({ ios: 32, default: 20 }),
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  scanAgain: {
    fontSize: 14,
    fontWeight: "500",
  },
  deviceList: {
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
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
  connectingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 12,
  },
  connectingText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
