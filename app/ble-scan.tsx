import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DeviceCard } from "@/components/ble/device-card";
import { ScanHero } from "@/components/ble/scan-hero";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import type { BleRole, ScannedDevice } from "@/contexts/ble-context";
import { useBle } from "@/contexts/ble-context";
import { useHeartRate } from "@/contexts/heart-rate-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { AppHeader, Banner, Stack, useTheme } from "@/lib/design-system";

function parseRoleParam(raw: string | string[] | undefined): BleRole {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "hr" ? "hr" : "motion";
}

type HeroState =
  | "off"
  | "unauthorized"
  | "unavailable"
  | "unknown"
  | "scanning"
  | "complete";

export default function BleScanScreen() {
  const { tokens } = useTheme();
  const ble = useBle();
  const motionSelection = useMotionSensor();
  const hrSelection = useHeartRate();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = parseRoleParam(params.role);
  const { t } = useTranslation("ble");
  const { t: tc } = useTranslation("common");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const didAutoStartRef = useRef(false);
  const { availability, startScan, stopScan } = ble;

  // Devices we don't have a decoder for can't actually be used, so we hide
  // them entirely instead of cluttering the list. The decoder match is
  // already role-aware (set inside the BLE context based on the active
  // scan), so a stray motion sensor won't appear here during an HR scan.
  const supportedDevices = useMemo(
    () => ble.devices.filter((d) => d.decoder),
    [ble.devices],
  );

  // Pick the slot that matches the active scan so notices and "connecting"
  // copy reflect the right connection attempt.
  const slot = role === "hr" ? ble.hr : ble.motion;

  useEffect(() => {
    if (availability === "on" && !didAutoStartRef.current) {
      didAutoStartRef.current = true;
      void startScan({ role });
    }
  }, [availability, role, startScan]);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  const handlePressDevice = async (device: ScannedDevice) => {
    setPendingId(device.id);
    const connected = await ble.connect(device.id, role);
    setPendingId(null);
    if (connected) {
      const label =
        connected.name ??
        connected.localName ??
        t("device.fallbackLabel", { suffix: connected.id.slice(-5) });
      const args = {
        deviceLabel: label,
        bleDeviceId: connected.id,
        decoderKey: connected.decoder?.key ?? null,
      };
      if (role === "hr") {
        hrSelection.selectBle(args);
      } else {
        motionSelection.selectBle(args);
      }
      router.dismiss();
    }
  };

  const close = () => {
    ble.stopScan();
    router.dismiss();
  };

  const heroState: HeroState = (() => {
    if (ble.availability === "off") {
      return "off";
    }
    if (ble.availability === "unauthorized") {
      return "unauthorized";
    }
    if (ble.availability === "unavailable") {
      return "unavailable";
    }
    if (ble.availability === "unknown") {
      return "unknown";
    }
    if (ble.scanning) {
      return "scanning";
    }
    return "complete";
  })();
  const heroTitle = t(`scan.hero.${heroState}.title`);
  const heroSubtitle = t(`scan.hero.${heroState}.subtitle`);

  return (
    <ThemedView style={styles.root}>
      <AppHeader
        title={t(`scan.navTitle.${role}`)}
        leading={
          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tc("actions.cancel")}
          >
            <Text style={[styles.cancelLabel, { color: tokens.colors.accent }]}>
              {tc("actions.cancel")}
            </Text>
          </Pressable>
        }
      />

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

        {ble.scanError ? <Banner tone="warning">{ble.scanError}</Banner> : null}

        {slot.connectionError && pendingId === null ? (
          <Banner tone="warning">
            {t("scan.connectError", { error: slot.connectionError })}
          </Banner>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <ThemedText
            style={[
              styles.sectionHeader,
              { color: tokens.colors.textSecondary },
            ]}
          >
            {t(`scan.section.${role}`, { count: supportedDevices.length })}
          </ThemedText>
          {ble.scanning ? (
            <ActivityIndicator size="small" color={tokens.colors.accent} />
          ) : (
            <Pressable
              onPress={() => ble.startScan({ role })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={tc("actions.scanAgain")}
            >
              <ThemedText
                style={[styles.scanAgain, { color: tokens.colors.accent }]}
              >
                {tc("actions.scanAgain")}
              </ThemedText>
            </Pressable>
          )}
        </View>

        <Stack gap="xs">
          {supportedDevices.length === 0 && !ble.scanning ? (
            <ThemedText
              style={[styles.emptyText, { color: tokens.colors.textSecondary }]}
            >
              {t(`scan.empty.${role}`)}
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
        </Stack>

        {pendingId ? (
          <View style={styles.connectingFooter}>
            <ActivityIndicator size="small" color={tokens.colors.accent} />
            <ThemedText
              style={[styles.connectingText, { color: tokens.colors.accent }]}
            >
              {t("scan.connecting")}
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
  cancelLabel: {
    fontSize: 17,
    fontWeight: "500",
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
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
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
