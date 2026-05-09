import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RowMetricsCard } from "@/components/row/row-metrics-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBle } from "@/contexts/ble-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHeartRateStream } from "@/hooks/use-heart-rate-stream";
import { useMotionStream } from "@/hooks/use-motion-stream";
import { useStrokeSession } from "@/hooks/use-stroke-session";
import { createActivityRecorder } from "@/lib/activity/recorder";
import { shareFitFile } from "@/lib/activity/share";
import { saveActivity, type StoredActivity } from "@/lib/activity/storage";
import { formatDuration } from "@/lib/format/time";

const COLORS = {
  light: {
    accent: "#0a7ea4",
    helper: "#687076",
    placeholderBorder: "#D1D5DA",
    placeholderText: "#9BA1A6",
    permissionBg: "rgba(224, 138, 30, 0.12)",
    permissionBorder: "rgba(224, 138, 30, 0.4)",
    permissionText: "#9C5E0E",
    primaryBg: "#0a7ea4",
    primaryText: "#FFFFFF",
    dangerBg: "#C5283D",
    dangerText: "#FFFFFF",
    secondaryBg: "rgba(10, 126, 164, 0.12)",
    secondaryText: "#0a7ea4",
    successBg: "rgba(46, 160, 67, 0.12)",
    successBorder: "rgba(46, 160, 67, 0.4)",
    successText: "#1F6F2C",
  },
  dark: {
    accent: "#3DB7E0",
    helper: "#9BA1A6",
    placeholderBorder: "#2F3236",
    placeholderText: "#6E7174",
    permissionBg: "rgba(255, 176, 32, 0.14)",
    permissionBorder: "rgba(255, 176, 32, 0.45)",
    permissionText: "#FFB020",
    primaryBg: "#3DB7E0",
    primaryText: "#0B1115",
    dangerBg: "#E94B5E",
    dangerText: "#0B1115",
    secondaryBg: "rgba(61, 183, 224, 0.18)",
    secondaryText: "#7CD3F2",
    successBg: "rgba(70, 200, 100, 0.16)",
    successBorder: "rgba(70, 200, 100, 0.45)",
    successText: "#7BE08F",
  },
} as const;

type Palette = (typeof COLORS)[keyof typeof COLORS];

/** Recording lifecycle states. The UI flips between primary buttons (Start, Stop, Share) and notice content based on this. */
type RecordingPhase = "armed" | "running" | "saving" | "saved";

export default function FreeRowScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const insets = useSafeAreaInsets();
  const { source, deviceLabel: rawDeviceLabel } = useMotionSensor();
  const stream = useMotionStream();
  const strokeSession = useStrokeSession();
  const heartRate = useHeartRateStream();
  const ble = useBle();
  const { t } = useTranslation("row");

  const deviceLabel =
    source === "phone" ? t("phone.label") : (rawDeviceLabel ?? null);

  // The recorder is ref-held so React re-renders don't reset its internal
  // accumulators. We never re-create it; the recorder's own `start()`
  // resets state for the next session.
  const recorderRef = useRef(createActivityRecorder());
  const [phase, setPhase] = useState<RecordingPhase>("armed");
  const [savedActivity, setSavedActivity] = useState<StoredActivity | null>(
    null,
  );

  // The metrics ref is kept fresh on every render so the 1 Hz tick driver
  // can read the latest values without re-running its effect on every
  // metrics change (which would defeat the throttle).
  const metricsRef = useRef({
    cadenceSpm: 0,
    paceSecondsPer500m: Number.POSITIVE_INFINITY,
    strokeCount: 0,
    heartRateBpm: null as number | null,
  });
  metricsRef.current = {
    cadenceSpm: strokeSession.cadenceSpm,
    paceSecondsPer500m: strokeSession.paceSecondsPer500m,
    strokeCount: strokeSession.strokeCount,
    heartRateBpm: heartRate.bpm,
  };

  // Drive the 1 Hz snapshot stream from a setInterval rather than the
  // motion sample arrival, so the recorder samples cadence/HR even during
  // pauses where the sensor briefly stops streaming.
  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    const id = setInterval(() => {
      recorderRef.current.tick(metricsRef.current, Date.now());
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  // Forward each detected stroke to the recorder. The session hook clears
  // strokeJustDetected after one render, so we observe each stroke as a
  // single edge event.
  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    if (!strokeSession.strokeJustDetected) {
      return;
    }
    recorderRef.current.markStroke(strokeSession.cadenceSpm, Date.now());
  }, [phase, strokeSession.strokeJustDetected, strokeSession.cadenceSpm]);

  const handleStart = useCallback(() => {
    strokeSession.reset();
    recorderRef.current.start(Date.now());
    setPhase("running");
  }, [strokeSession]);

  const handleStop = useCallback(async () => {
    if (!recorderRef.current.isRunning) {
      return;
    }
    setPhase("saving");
    try {
      const activity = recorderRef.current.finish(Date.now());
      const stored = await saveActivity(activity);
      setSavedActivity(stored);
      setPhase("saved");
    } catch (e) {
      console.error("[free-row] save failed", e);
      Alert.alert(
        t("freeRow.recording.saveErrorTitle"),
        t("freeRow.recording.saveErrorBody"),
      );
      setPhase("armed");
    }
  }, [t]);

  const handleDiscardRunning = useCallback(() => {
    Alert.alert(
      t("freeRow.recording.discardTitle"),
      t("freeRow.recording.discardBody"),
      [
        {
          text: t("freeRow.recording.discard"),
          style: "destructive",
          onPress: () => {
            if (recorderRef.current.isRunning) {
              recorderRef.current.finish(Date.now());
            }
            setPhase("armed");
          },
        },
        { text: t("freeRow.back"), style: "cancel" },
      ],
    );
  }, [t]);

  const handleShare = useCallback(async () => {
    if (!savedActivity) {
      return;
    }
    try {
      const result = await shareFitFile(
        savedActivity.fitFileUri,
        t("freeRow.recording.shareDialogTitle"),
      );
      if (result === "unavailable") {
        Alert.alert(t("freeRow.recording.shareUnavailable"));
      }
    } catch (e) {
      // The user dismissing the share sheet rejects the promise on iOS;
      // there's nothing actionable to surface, so we swallow it.
      console.warn("[free-row] share failed", e);
    }
  }, [savedActivity, t]);

  const handleAcknowledgeSaved = useCallback(() => {
    setSavedActivity(null);
    setPhase("armed");
  }, []);

  const handleBack = useCallback(() => {
    if (phase === "running") {
      handleDiscardRunning();
      return;
    }
    router.back();
  }, [handleDiscardRunning, phase]);

  const motionReady = useMemo(() => {
    if (source === "none") {
      return false;
    }
    if (source === "phone") {
      return stream.isAvailable && !stream.permissionDenied;
    }
    return !!ble.motion.activeDevice && stream.hasDecoder && stream.isAvailable;
  }, [
    source,
    stream.isAvailable,
    stream.permissionDenied,
    stream.hasDecoder,
    ble.motion.activeDevice,
  ]);

  const metricsCardProps = {
    strokeCount: strokeSession.strokeCount,
    cadenceSpm: strokeSession.cadenceSpm,
    paceSecondsPer500m: strokeSession.paceSecondsPer500m,
    elapsedSeconds: strokeSession.elapsedSeconds,
    heartRateBpm: heartRate.bpm,
    sampleRateHz: stream.sampleRateHz,
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

  const renderRecordingControls = () => {
    if (!motionReady && phase !== "saved") {
      return null;
    }

    if (phase === "armed") {
      return (
        <View style={styles.controlsBlock}>
          <ThemedText
            style={[styles.controlsHelper, { color: palette.helper }]}
          >
            {t("freeRow.recording.armed")}
          </ThemedText>
          <PrimaryButton
            label={t("freeRow.recording.start")}
            onPress={handleStart}
            palette={palette}
          />
        </View>
      );
    }

    if (phase === "running") {
      return (
        <View style={styles.controlsBlock}>
          <ThemedText
            style={[styles.controlsHelper, { color: palette.helper }]}
          >
            {t("freeRow.recording.running")}
          </ThemedText>
          <DangerButton
            label={t("freeRow.recording.stop")}
            onPress={handleStop}
            palette={palette}
          />
        </View>
      );
    }

    if (phase === "saving") {
      return (
        <View style={styles.controlsBlock}>
          <ActivityIndicator color={palette.accent} />
          <ThemedText
            style={[styles.controlsHelper, { color: palette.helper }]}
          >
            {t("freeRow.recording.savingBody")}
          </ThemedText>
        </View>
      );
    }

    // saved
    return (
      <View style={styles.controlsBlock}>
        <View
          style={[
            styles.savedNotice,
            {
              backgroundColor: palette.successBg,
              borderColor: palette.successBorder,
            },
          ]}
        >
          <ThemedText
            style={[styles.savedTitle, { color: palette.successText }]}
          >
            {t("freeRow.recording.savedTitle")}
          </ThemedText>
          {savedActivity ? (
            <ThemedText
              style={[styles.savedBody, { color: palette.successText }]}
            >
              {t("freeRow.recording.savedBody", {
                duration: formatDuration(savedActivity.summary.durationS),
                strokes: savedActivity.summary.strokeCount,
              })}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.savedActions}>
          <PrimaryButton
            label={t("freeRow.recording.share")}
            onPress={handleShare}
            palette={palette}
            style={styles.savedActionFlex}
          />
          <SecondaryButton
            label={t("freeRow.back")}
            onPress={handleAcknowledgeSaved}
            palette={palette}
            style={styles.savedActionFlex}
          />
        </View>
      </View>
    );
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

      <View style={styles.body}>
        {renderDataSection()}
        {renderRecordingControls()}
      </View>
    </ThemedView>
  );
}

function Notice({
  palette,
  children,
}: {
  palette: Palette;
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

function PrimaryButton({
  label,
  onPress,
  palette,
  style,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.primaryBg, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <ThemedText style={[styles.buttonLabel, { color: palette.primaryText }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function DangerButton({
  label,
  onPress,
  palette,
  style,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.dangerBg, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <ThemedText style={[styles.buttonLabel, { color: palette.dangerText }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  palette,
  style,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.secondaryBg, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <ThemedText
        style={[styles.buttonLabel, { color: palette.secondaryText }]}
      >
        {label}
      </ThemedText>
    </Pressable>
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
  controlsBlock: {
    gap: 12,
    marginTop: 4,
  },
  controlsHelper: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  savedNotice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  savedTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  savedBody: {
    fontSize: 14,
    lineHeight: 18,
  },
  savedActions: {
    flexDirection: "row",
    gap: 12,
  },
  savedActionFlex: {
    flex: 1,
  },
});
