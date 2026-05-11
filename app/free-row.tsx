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
import { useProfile } from "@/contexts/profile-context";
import { useHeartRateStream } from "@/hooks/use-heart-rate-stream";
import { useHrZoneResolver } from "@/hooks/use-hr-zone-resolver";
import { useMotionStream } from "@/hooks/use-motion-stream";
import { useStrokeSession } from "@/hooks/use-stroke-session";
import { createActivityRecorder } from "@/lib/activity/recorder";
import { accumulateKcal } from "@/lib/energy/calories";
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

/** Recording lifecycle states. The UI flips between primary buttons (Start, Stop, Pause/Resume, Lap, Share) and notice content based on this. */
type RecordingPhase = "armed" | "running" | "paused" | "saving" | "saved";

export default function FreeRowScreen() {
  const { tokens } = useTheme();
  const { source, deviceLabel: rawDeviceLabel } = useMotionSensor();
  const stream = useMotionStream();
  const strokeSession = useStrokeSession();
  const heartRate = useHeartRateStream();
  const ble = useBle();
  const { resolved: profile } = useProfile();
  const zoneResolver = useHrZoneResolver();
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

  // Display-layer gating for items 2 and 3 of the row-fixes plan.
  //
  // The stroke session keeps running whenever motion data is flowing so
  // the calibration progress (C4) can count toward 5 strokes before the
  // user taps Start. To keep the metrics card honest in the meantime,
  // we anchor a separate "recording started" wall-clock timestamp on
  // Start and snapshot the session's stroke count at the same moment.
  // The displayed strokes / total time are derived from those anchors
  // so calibration strokes don't leak into the recording's display
  // (or, downstream, into the recorder's snapshot stream).
  const [recordingStartedAtMs, setRecordingStartedAtMs] = useState<
    number | null
  >(null);
  const [recordingStartStrokeCount, setRecordingStartStrokeCount] = useState(0);
  // Pause/Lap state (C6 of the row-fixes plan). Pause windows freeze the
  // displayed total time, stroke count, and lap timer without resetting
  // the underlying stroke session — so calibration survives a pause and
  // resume just like it survives a save.
  const [pauseStartedAtMs, setPauseStartedAtMs] = useState<number | null>(null);
  const [pausedTotalMs, setPausedTotalMs] = useState(0);
  const [sessionStrokesAtPauseStart, setSessionStrokesAtPauseStart] =
    useState(0);
  const [strokesDuringPauses, setStrokesDuringPauses] = useState(0);
  // Lap timer: the moving-time offset (ms since recording start, paused
  // windows excluded) at which the user last tapped Lap. `null` means no
  // lap has been started yet — the metrics card collapses the row.
  const [lapStartedAtMovingMs, setLapStartedAtMovingMs] = useState<
    number | null
  >(null);
  // A 4 Hz "now" tick that drives the total-time / lap-time displays. We
  // don't couple to the motion-sample cadence (which would re-render at
  // 50 Hz even just to advance the seconds digit). The ticker keeps
  // running through pauses so the open-pause subtraction still freezes
  // the display smoothly; outside running/paused the value is unused.
  const [nowMs, setNowMs] = useState(() => Date.now());
  // HR-derived cumulative calorie estimate (C8). The ref is the source
  // of truth for the integrator (so successive ticks compose without
  // races on stale state); the state mirror drives the metrics card
  // re-render. `null` means "no HR has ever been observed during this
  // recording" — at which point the recorder's snapshots also carry
  // null so `summary.totalCaloriesKcal` ends up null in the saved
  // activity, distinguishing "HRM-less recording" from "0 kcal".
  const caloriesKcalRef = useRef(0);
  const caloriesLastTickMsRef = useRef<number | null>(null);
  const hasSeenHrRef = useRef(false);
  const [caloriesKcal, setCaloriesKcal] = useState<number | null>(null);

  // Current open-pause duration (ms) and stroke count: the running pause
  // window isn't folded into the cumulative `pausedTotalMs` until resume,
  // so we apply the open window separately on every render.
  const currentPauseMs =
    pauseStartedAtMs != null ? Math.max(0, nowMs - pauseStartedAtMs) : 0;
  const currentPauseStrokes =
    pauseStartedAtMs != null
      ? Math.max(0, strokeSession.strokeCount - sessionStrokesAtPauseStart)
      : 0;
  const movingMsSinceStart =
    recordingStartedAtMs == null
      ? 0
      : Math.max(
          0,
          nowMs - recordingStartedAtMs - pausedTotalMs - currentPauseMs,
        );

  const displayStrokeCount =
    recordingStartedAtMs == null
      ? 0
      : Math.max(
          0,
          strokeSession.strokeCount -
            recordingStartStrokeCount -
            strokesDuringPauses -
            currentPauseStrokes,
        );
  const displayTotalTimeSeconds =
    recordingStartedAtMs == null ? 0 : movingMsSinceStart / 1000;
  const displayLapElapsedSeconds =
    lapStartedAtMovingMs == null
      ? null
      : Math.max(0, (movingMsSinceStart - lapStartedAtMovingMs) / 1000);
  // Calibration plumbing.
  //
  // Calibration is non-blocking: the user can tap Start at any point,
  // and the recorder captures cadence + strokes from t=0 (the metrics
  // ref is fed regardless of calibration state). What we DON'T do is
  // render a numeric cadence until the detector has stabilised — until
  // then the cadence slot in the metrics card shows the animated
  // <CalibrationWaveform> so the user sees we're still listening.
  //
  // Concretely: while `calibrationState !== "calibrated"`, pass that
  // state to the metrics card so it renders the waveform; once
  // calibrated, pass `null` to flip back to the live cadence Stat.
  // This applies both pre-recording (armed) and during the recording
  // itself (running / paused).
  //
  // Calibration persists across recording sessions: after a save the
  // user is dropped back into `armed`, and `calibrationState` is
  // latched at "calibrated" so the cadence stat stays visible. The
  // session is reset (and calibration restarts) only when the motion
  // source changes — see `useStrokeSession`.
  const calibrationStateForCard =
    strokeSession.calibrationState !== "calibrated"
      ? strokeSession.calibrationState
      : null;

  // The metrics ref is kept fresh on every render so the 1 Hz tick driver
  // can read the latest values without re-running its effect on every
  // metrics change (which would defeat the throttle). The recorder gets
  // the *display* stroke count so its per-record snapshots are
  // recording-relative (calibration strokes are excluded by construction).
  const metricsRef = useRef({
    cadenceSpm: 0,
    paceSecondsPer500m: Number.POSITIVE_INFINITY,
    strokeCount: 0,
    heartRateBpm: null as number | null,
    caloriesKcal: null as number | null,
  });
  metricsRef.current = {
    cadenceSpm: strokeSession.cadenceSpm,
    paceSecondsPer500m: strokeSession.paceSecondsPer500m,
    strokeCount: displayStrokeCount,
    heartRateBpm: heartRate.bpm,
    caloriesKcal: hasSeenHrRef.current ? caloriesKcalRef.current : null,
  };

  // Drive the 1 Hz snapshot stream from a setInterval rather than the
  // motion sample arrival, so the recorder samples cadence/HR even during
  // pauses where the sensor briefly stops streaming. The same loop also
  // refreshes the `nowMs` state so the displayed total / lap times keep
  // moving. The recorder itself ignores `tick()` while paused, so it's
  // safe to call here regardless of phase as long as a recording is in
  // flight.
  useEffect(() => {
    if (phase !== "running" && phase !== "paused") {
      return;
    }
    const id = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      // Integrate HR-driven calories before reading metricsRef into the
      // recorder, so the snapshot we hand to the recorder reflects the
      // value just produced. We only advance the integration while
      // running; while paused we just slide the anchor forward so the
      // first tick after Resume uses a small dt instead of the entire
      // pause window.
      if (phase === "running") {
        const last = caloriesLastTickMsRef.current ?? now;
        const dtSeconds = Math.max(0, (now - last) / 1000);
        const hr = heartRate.bpm;
        if (hr != null && Number.isFinite(hr) && hr > 0) {
          hasSeenHrRef.current = true;
        }
        if (dtSeconds > 0) {
          caloriesKcalRef.current = accumulateKcal(
            caloriesKcalRef.current,
            hr,
            dtSeconds,
            {
              weightKg: profile.weightKg,
              ageYears: profile.ageYears,
              sex: profile.sex,
            },
          );
        }
        // Mirror the running total into state so the metrics card
        // re-renders with the new value. Once HR has been seen we keep
        // `caloriesKcal` non-null for the rest of the recording so
        // brief HRM dropouts don't make the column flicker out.
        if (hasSeenHrRef.current) {
          setCaloriesKcal(caloriesKcalRef.current);
          metricsRef.current = {
            ...metricsRef.current,
            caloriesKcal: caloriesKcalRef.current,
          };
        }
      }
      caloriesLastTickMsRef.current = now;
      recorderRef.current.tick(metricsRef.current, now);
    }, 250);
    return () => clearInterval(id);
  }, [phase, heartRate.bpm, profile.weightKg, profile.ageYears, profile.sex]);

  // Forward each detected stroke to the recorder. The session hook clears
  // strokeJustDetected after one render, so we observe each stroke as a
  // single edge event. Already gated on `phase === "running"`, which is
  // what keeps calibration strokes (detected while in `armed`) out of the
  // recording.
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
    // Note: we deliberately do NOT call strokeSession.reset() here.
    // Resetting the session would clear the calibrated baseline /
    // threshold / cadence EMA the user just spent 5 strokes warming up.
    // Instead we snapshot the current stroke count so future displays
    // are recording-relative.
    const now = Date.now();
    setRecordingStartStrokeCount(strokeSession.strokeCount);
    setRecordingStartedAtMs(now);
    setPauseStartedAtMs(null);
    setPausedTotalMs(0);
    setStrokesDuringPauses(0);
    setLapStartedAtMovingMs(null);
    setNowMs(now);
    caloriesKcalRef.current = 0;
    caloriesLastTickMsRef.current = null;
    hasSeenHrRef.current = false;
    setCaloriesKcal(null);
    recorderRef.current.start(now);
    setPhase("running");
  }, [strokeSession.strokeCount]);

  const handlePause = useCallback(() => {
    if (phase !== "running") {
      return;
    }
    const now = Date.now();
    setSessionStrokesAtPauseStart(strokeSession.strokeCount);
    setPauseStartedAtMs(now);
    setNowMs(now);
    recorderRef.current.pause(now);
    setPhase("paused");
  }, [phase, strokeSession.strokeCount]);

  const handleResume = useCallback(() => {
    if (phase !== "paused" || pauseStartedAtMs == null) {
      return;
    }
    const now = Date.now();
    const pauseSpanMs = Math.max(0, now - pauseStartedAtMs);
    const pauseStrokes = Math.max(
      0,
      strokeSession.strokeCount - sessionStrokesAtPauseStart,
    );
    setPausedTotalMs((prev) => prev + pauseSpanMs);
    setStrokesDuringPauses((prev) => prev + pauseStrokes);
    setPauseStartedAtMs(null);
    setNowMs(now);
    recorderRef.current.resume(now);
    setPhase("running");
  }, [
    phase,
    pauseStartedAtMs,
    sessionStrokesAtPauseStart,
    strokeSession.strokeCount,
  ]);

  const handleLap = useCallback(() => {
    if (phase !== "running" || recordingStartedAtMs == null) {
      return;
    }
    // Anchor the lap timer to the moving-time clock so the displayed
    // lap duration freezes during pauses, exactly like total time.
    const now = Date.now();
    const movingMsNow = Math.max(0, now - recordingStartedAtMs - pausedTotalMs);
    setLapStartedAtMovingMs(movingMsNow);
    setNowMs(now);
  }, [phase, recordingStartedAtMs, pausedTotalMs]);

  // Centralised reset for the local recording-display state. Called by
  // handlers that transition out of an in-flight recording (stop, save,
  // discard, error, acknowledge) so the next session starts clean
  // without resetting the stroke session (calibration persists).
  const resetRecordingDisplay = useCallback(() => {
    setRecordingStartedAtMs(null);
    setPauseStartedAtMs(null);
    setPausedTotalMs(0);
    setStrokesDuringPauses(0);
    setSessionStrokesAtPauseStart(0);
    setLapStartedAtMovingMs(null);
    caloriesKcalRef.current = 0;
    caloriesLastTickMsRef.current = null;
    hasSeenHrRef.current = false;
    setCaloriesKcal(null);
  }, []);

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
      resetRecordingDisplay();
    }
  }, [resetRecordingDisplay, t]);

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
            resetRecordingDisplay();
          },
        },
        { text: t("freeRow.back"), style: "cancel" },
      ],
    );
  }, [resetRecordingDisplay, t]);

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
    resetRecordingDisplay();
  }, [resetRecordingDisplay]);

  const handleBack = useCallback(() => {
    if (phase === "running" || phase === "paused") {
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
    strokeCount: displayStrokeCount,
    cadenceSpm: strokeSession.cadenceSpm,
    paceSecondsPer500m: strokeSession.paceSecondsPer500m,
    elapsedSeconds: displayTotalTimeSeconds,
    lapElapsedSeconds: displayLapElapsedSeconds,
    calibrationState: calibrationStateForCard,
    heartRateBpm: heartRate.bpm,
    caloriesKcal,
  };

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
      {heartRate.bpm != null ? (
        zoneResolver.kind === "cogganFriel7" ? (
          // The resolver's `current` zone is one of the Coggan keys
          // here by construction; the cast just satisfies the
          // discriminated-union prop on `<ZoneBar>`.
          <ZoneBar
            model="cogganFriel7"
            current={zoneResolver.resolve(heartRate.bpm)}
          />
        ) : (
          <ZoneBar
            model="garminPolar5"
            current={zoneResolver.resolve(heartRate.bpm)}
          />
        )
      ) : null}
      <RowMetricsCard {...metricsCardProps} />
    </Stack>
  );

  const renderRecordingControls = () => {
    if (!motionReady && phase !== "saved") {
      return null;
    }

    if (phase === "armed") {
      // Start is always enabled. Calibration runs in the background
      // (and continues running once recording starts); until it
      // stabilises, the metrics card shows the waveform in the
      // cadence slot instead of a number, so the user has a visual
      // signal without being blocked from starting.
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

    if (phase === "running" || phase === "paused") {
      const isPaused = phase === "paused";
      return (
        <View style={styles.controlsBlock}>
          <ThemedText
            style={[
              styles.controlsHelper,
              { color: tokens.colors.textSecondary },
            ]}
          >
            {isPaused
              ? t("freeRow.recording.paused")
              : t("freeRow.recording.running")}
          </ThemedText>
          <View style={styles.runningControlsRow}>
            <View style={styles.runningControlsCell}>
              <Button
                title={
                  isPaused
                    ? t("freeRow.recording.resume")
                    : t("freeRow.recording.pause")
                }
                onPress={isPaused ? handleResume : handlePause}
                tone="neutral"
                variant="tinted"
                size="lg"
                block
              />
            </View>
            <View style={styles.runningControlsCell}>
              <Button
                title={t("freeRow.recording.lap")}
                onPress={handleLap}
                disabled={isPaused}
                tone="neutral"
                variant="tinted"
                size="lg"
                block
              />
            </View>
          </View>
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
        <ThemedText
          style={[
            styles.savedDisclosure,
            { color: tokens.colors.textSecondary },
          ]}
        >
          {t("freeRow.recording.savedDisclosure")}
        </ThemedText>
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
  savedDisclosure: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  runningControlsRow: {
    flexDirection: "row",
    gap: 12,
  },
  runningControlsCell: {
    flex: 1,
  },
});
