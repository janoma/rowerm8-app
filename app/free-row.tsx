import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RowMetricsCard } from "@/components/row/row-metrics-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBle } from "@/contexts/ble-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMotionStream } from "@/hooks/use-motion-stream";
import { useStrokeSession } from "@/hooks/use-stroke-session";

const COLORS = {
  light: {
    accent: "#0a7ea4",
    helper: "#687076",
    placeholderBorder: "#D1D5DA",
    placeholderText: "#9BA1A6",
    permissionBg: "rgba(224, 138, 30, 0.12)",
    permissionBorder: "rgba(224, 138, 30, 0.4)",
    permissionText: "#9C5E0E",
  },
  dark: {
    accent: "#3DB7E0",
    helper: "#9BA1A6",
    placeholderBorder: "#2F3236",
    placeholderText: "#6E7174",
    permissionBg: "rgba(255, 176, 32, 0.14)",
    permissionBorder: "rgba(255, 176, 32, 0.45)",
    permissionText: "#FFB020",
  },
} as const;

export default function FreeRowScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const insets = useSafeAreaInsets();
  const { source, deviceLabel: rawDeviceLabel } = useMotionSensor();
  const stream = useMotionStream();
  const strokeSession = useStrokeSession();
  const ble = useBle();
  const { t } = useTranslation("row");

  const deviceLabel =
    source === "phone" ? t("phone.label") : (rawDeviceLabel ?? null);

  const metricsCardProps = {
    strokeCount: strokeSession.strokeCount,
    cadenceSpm: strokeSession.cadenceSpm,
    paceSecondsPer500m: strokeSession.paceSecondsPer500m,
    elapsedSeconds: strokeSession.elapsedSeconds,
    sampleRateHz: stream.sampleRateHz,
  };

  const handleBack = () => {
    router.back();
  };

  const renderDataSection = () => {
    if (source === "none") {
      return (
        <View
          style={[
            styles.placeholder,
            { borderColor: palette.placeholderBorder },
          ]}
        >
          <ThemedText
            style={[styles.placeholderText, { color: palette.placeholderText }]}
          >
            {t("freeRow.placeholder")}
          </ThemedText>
        </View>
      );
    }

    if (source === "phone") {
      if (stream.permissionDenied) {
        return <Notice palette={palette}>{t("phone.noPermission")}</Notice>;
      }
      if (!stream.isAvailable) {
        return <Notice palette={palette}>{t("phone.noAccelerometer")}</Notice>;
      }
      return <RowMetricsCard {...metricsCardProps} />;
    }

    if (!ble.motion.activeDevice) {
      return (
        <Notice palette={palette}>
          {deviceLabel
            ? t("ble.reconnect", { label: deviceLabel })
            : t("ble.reconnectFallback")}
        </Notice>
      );
    }

    if (!stream.hasDecoder) {
      return (
        <Notice palette={palette}>
          {deviceLabel
            ? t("ble.noDecoder", { label: deviceLabel })
            : t("ble.noDecoderFallback")}
        </Notice>
      );
    }

    if (!stream.isAvailable) {
      return (
        <Notice palette={palette}>
          {deviceLabel
            ? t("ble.connecting", { label: deviceLabel })
            : t("ble.connectingFallback")}
        </Notice>
      );
    }

    return <RowMetricsCard {...metricsCardProps} />;
  };

  return (
    <ThemedView style={styles.root}>
      <View style={[styles.safeTop, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.navBar}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("freeRow.back")}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={20} color={palette.accent} />
            <ThemedText style={[styles.backLabel, { color: palette.accent }]}>
              {t("freeRow.back")}
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.navTitle}>{t("freeRow.title")}</ThemedText>
          <View style={styles.navActionPlaceholder} />
        </View>
      </View>

      <View style={styles.body}>{renderDataSection()}</View>
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
  safeTop: {
    paddingHorizontal: 16,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 60,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: "500",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  navActionPlaceholder: {
    width: 60,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
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
