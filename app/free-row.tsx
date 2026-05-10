import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { RowMetricsCard } from "@/components/row/row-metrics-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { APP_NAME } from "@/constants/branding";
import { useBle } from "@/contexts/ble-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { useHeartRateStream } from "@/hooks/use-heart-rate-stream";
import { useMotionStream } from "@/hooks/use-motion-stream";
import { useStrokeSession } from "@/hooks/use-stroke-session";
import { createActivityRecorder } from "@/lib/activity/recorder";
import { shareFitFile } from "@/lib/activity/share";
import { saveActivity, type StoredActivity } from "@/lib/activity/storage";
import {
  AppHeader,
  Banner,
  Button,
  EmptyState,
  Stack,
  ZoneBar,
  useTheme,
} from "@/lib/design-system";
import { formatDuration } from "@/lib/format/time";
import { zoneForBpm } from "@/lib/hr/zones";

/** Recording lifecycle states. The UI flips between primary buttons (Start, Stop, Share) and notice content based on this. */
type RecordingPhase = "armed" | "running" | "saving" | "saved";

export default function FreeRowScreen() {
  const { tokens } = useTheme();
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

  const currentZone = zoneForBpm(heartRate.bpm);

  const renderDataSection = () => {
    if (source === "none") {
      return <EmptyState>{t("freeRow.placeholder")}</EmptyState>;
    }

    if (source === "phone") {
      if (stream.permissionDenied) {
        return (
          <Banner tone="warning">
            {t("phone.noPermission", { appName: APP_NAME })}
          </Banner>
        );
      }
      if (!stream.isAvailable) {
        return <Banner tone="warning">{t("phone.noAccelerometer")}</Banner>;
      }
      return renderMetrics();
    }

    if (!ble.motion.activeDevice) {
      return (
        <Banner tone="warning">
          {deviceLabel
            ? t("ble.reconnect", { label: deviceLabel })
            : t("ble.reconnectFallback")}
        </Banner>
      );
    }

    if (!stream.hasDecoder) {
      return (
        <Banner tone="warning">
          {deviceLabel
            ? t("ble.noDecoder", { label: deviceLabel, appName: APP_NAME })
            : t("ble.noDecoderFallback", { appName: APP_NAME })}
        </Banner>
      );
    }

    if (!stream.isAvailable) {
      return (
        <Banner tone="warning">
          {deviceLabel
            ? t("ble.connecting", { label: deviceLabel })
            : t("ble.connectingFallback")}
        </Banner>
      );
    }

    return renderMetrics();
  };

  const renderMetrics = () => (
    <Stack gap="sm">
      {heartRate.bpm != null ? <ZoneBar current={currentZone} /> : null}
      <RowMetricsCard {...metricsCardProps} />
    </Stack>
  );

  const renderRecordingControls = () => {
    if (!motionReady && phase !== "saved") {
      return null;
    }

    if (phase === "armed") {
      return (
        <View style={styles.controlsBlock}>
          <ThemedText
            style={[
              styles.controlsHelper,
              { color: tokens.colors.textSecondary },
            ]}
          >
            {t("freeRow.recording.armed")}
          </ThemedText>
          <Button
            title={t("freeRow.recording.start")}
            onPress={handleStart}
            tone="accent"
            variant="filled"
            size="lg"
            block
          />
        </View>
      );
    }

    if (phase === "running") {
      return (
        <View style={styles.controlsBlock}>
          <ThemedText
            style={[
              styles.controlsHelper,
              { color: tokens.colors.textSecondary },
            ]}
          >
            {t("freeRow.recording.running")}
          </ThemedText>
          <Button
            title={t("freeRow.recording.stop")}
            onPress={handleStop}
            tone="danger"
            variant="filled"
            size="lg"
            block
          />
        </View>
      );
    }

    if (phase === "saving") {
      return (
        <View style={styles.controlsBlock}>
          <ActivityIndicator color={tokens.colors.accent} />
          <ThemedText
            style={[
              styles.controlsHelper,
              { color: tokens.colors.textSecondary },
            ]}
          >
            {t("freeRow.recording.savingBody")}
          </ThemedText>
        </View>
      );
    }

    // saved
    return (
      <View style={styles.controlsBlock}>
        <Banner tone="success" title={t("freeRow.recording.savedTitle")}>
          {savedActivity
            ? t("freeRow.recording.savedBody", {
                duration: formatDuration(savedActivity.summary.durationS),
                strokes: savedActivity.summary.strokeCount,
              })
            : ""}
        </Banner>
        <View style={styles.savedActions}>
          <View style={styles.savedActionFlex}>
            <Button
              title={t("freeRow.recording.share")}
              onPress={handleShare}
              tone="accent"
              variant="filled"
              size="lg"
              block
            />
          </View>
          <View style={styles.savedActionFlex}>
            <Button
              title={t("freeRow.back")}
              onPress={handleAcknowledgeSaved}
              tone="neutral"
              variant="tinted"
              size="lg"
              block
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.root}>
      <AppHeader
        title={t("freeRow.title")}
        onBack={handleBack}
        backLabel={t("freeRow.back")}
      />
      <View style={styles.body}>
        {renderDataSection()}
        {renderRecordingControls()}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
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
  savedActions: {
    flexDirection: "row",
    gap: 12,
  },
  savedActionFlex: {
    flex: 1,
  },
});
