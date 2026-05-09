import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBle } from "@/contexts/ble-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMotionStream } from "@/hooks/use-motion-stream";

const COLORS = {
  light: {
    helper: "#687076",
    surface: "#F2F3F5",
    surfaceBorder: "#E4E6EA",
    title: "#11181C",
    accent: "#0a7ea4",
    accentSoft: "rgba(10, 126, 164, 0.10)",
    accentSoftBorder: "rgba(10, 126, 164, 0.28)",
    secondary: "#687076",
    secondarySoft: "rgba(104, 112, 118, 0.12)",
    secondarySoftBorder: "rgba(104, 112, 118, 0.30)",
    success: "#1F9D55",
    successBg: "rgba(31, 157, 85, 0.15)",
    warning: "#9C5E0E",
    warningBg: "rgba(224, 138, 30, 0.12)",
    warningBorder: "rgba(224, 138, 30, 0.4)",
    chevron: "#9BA1A6",
  },
  dark: {
    helper: "#9BA1A6",
    surface: "#1F2224",
    surfaceBorder: "#2A2D30",
    title: "#ECEDEE",
    accent: "#3DB7E0",
    accentSoft: "rgba(61, 183, 224, 0.14)",
    accentSoftBorder: "rgba(61, 183, 224, 0.36)",
    secondary: "#9BA1A6",
    secondarySoft: "rgba(155, 161, 166, 0.16)",
    secondarySoftBorder: "rgba(155, 161, 166, 0.34)",
    success: "#34C759",
    successBg: "rgba(52, 199, 89, 0.18)",
    warning: "#FFB020",
    warningBg: "rgba(255, 176, 32, 0.14)",
    warningBorder: "rgba(255, 176, 32, 0.45)",
    chevron: "#7C8186",
  },
} as const;

export default function RowScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const { t } = useTranslation("row");
  const { source, deviceLabel: rawDeviceLabel } = useMotionSensor();
  const stream = useMotionStream();
  const ble = useBle();

  const motionReady =
    (source === "phone" && stream.isAvailable && !stream.permissionDenied) ||
    (source === "ble" && !!ble.motion.activeDevice && stream.hasDecoder);

  const deviceLabel =
    source === "phone" ? t("phone.label") : (rawDeviceLabel ?? null);

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
          <ThemedText style={[styles.subtitle, { color: palette.helper }]}>
            {t("launcher.subtitle")}
          </ThemedText>

          {motionReady ? (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: palette.successBg,
                },
              ]}
            >
              <IconSymbol
                name="checkmark.circle.fill"
                size={18}
                color={palette.success}
              />
              <ThemedText
                style={[styles.statusPillText, { color: palette.success }]}
                numberOfLines={1}
              >
                {t("launcher.ready", {
                  label: deviceLabel ?? "",
                })}
              </ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.notice,
                {
                  backgroundColor: palette.warningBg,
                  borderColor: palette.warningBorder,
                },
              ]}
            >
              <ThemedText
                style={[styles.noticeText, { color: palette.warning }]}
              >
                {t("launcher.notReady")}
              </ThemedText>
              <Pressable
                onPress={handleGoHome}
                accessibilityRole="button"
                accessibilityLabel={t("launcher.a11yGoHome")}
                hitSlop={6}
              >
                <ThemedText
                  style={[styles.noticeAction, { color: palette.accent }]}
                >
                  {t("launcher.goHome")}
                </ThemedText>
              </Pressable>
            </View>
          )}

          <LauncherButton
            kind="primary"
            iconName="play.fill"
            title={t("launcher.freeRow.title")}
            subtitle={t("launcher.freeRow.subtitle")}
            disabled={!motionReady}
            onPress={handleFreeRow}
            a11y={t("launcher.freeRow.a11y")}
            palette={palette}
          />
          <LauncherButton
            kind="secondary"
            iconName="list.bullet"
            title={t("launcher.workout.title")}
            subtitle={t("launcher.workout.subtitle")}
            disabled={false}
            onPress={handleWorkout}
            a11y={t("launcher.workout.a11y")}
            palette={palette}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

type LauncherButtonProps = {
  kind: "primary" | "secondary";
  iconName: Parameters<typeof IconSymbol>[0]["name"];
  title: string;
  subtitle: string;
  disabled: boolean;
  onPress: () => void;
  a11y: string;
  palette: (typeof COLORS)[keyof typeof COLORS];
};

function LauncherButton({
  kind,
  iconName,
  title,
  subtitle,
  disabled,
  onPress,
  a11y,
  palette,
}: LauncherButtonProps) {
  const accentColor = kind === "primary" ? palette.accent : palette.secondary;
  const accentBg =
    kind === "primary" ? palette.accentSoft : palette.secondarySoft;
  const accentBorder =
    kind === "primary" ? palette.accentSoftBorder : palette.secondarySoftBorder;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.launcherCard,
        {
          backgroundColor: accentBg,
          borderColor: accentBorder,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.launcherIcon, { backgroundColor: palette.surface }]}>
        <IconSymbol name={iconName} size={28} color={accentColor} />
      </View>
      <View style={styles.launcherText}>
        <ThemedText style={[styles.launcherTitle, { color: palette.title }]}>
          {title}
        </ThemedText>
        <ThemedText
          style={[styles.launcherSubtitle, { color: palette.helper }]}
        >
          {subtitle}
        </ThemedText>
      </View>
      <IconSymbol name="chevron.right" size={20} color={palette.chevron} />
    </Pressable>
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
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  },
  noticeAction: {
    fontSize: 14,
    fontWeight: "600",
  },
  launcherCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  launcherIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherText: {
    flex: 1,
    gap: 2,
  },
  launcherTitle: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  launcherSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
});
