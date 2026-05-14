import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AutoStartModal } from "@/components/row/auto-start-modal";
import { RecoveryPrompt } from "@/components/row/recovery-prompt";
import { RowMetricsCard } from "@/components/row/row-metrics-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { APP_NAME } from "@/constants/branding";
import { useBle } from "@/contexts/ble-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import { useProfile } from "@/contexts/profile-context";
import { useAutoStartPref } from "@/hooks/use-auto-start-pref";
import { useHeartRateStream } from "@/hooks/use-heart-rate-stream";
import { useHrZoneResolver } from "@/hooks/use-hr-zone-resolver";
import { useInactivityReminderPref } from "@/hooks/use-inactivity-reminder-pref";
import { useMotionStream } from "@/hooks/use-motion-stream";
import { useStrokeSession } from "@/hooks/use-stroke-session";
import { deleteDraft, loadDraft, writeDraft } from "@/lib/activity/draft";
import {
  createActivityRecorder,
  INACTIVITY_AUTO_PAUSE_MS,
  INACTIVITY_AUTO_SAVE_MS,
} from "@/lib/activity/recorder";
import { shareFitFile } from "@/lib/activity/share";
import { classifyShortActivity } from "@/lib/activity/short-activity";
import { saveActivity, type StoredActivity } from "@/lib/activity/storage";
import {
  AppHeader,
  Banner,
  Button,
  EmptyState,
  Stack,
  useTheme,
  ZoneBar,
} from "@/lib/design-system";
import { accumulateKcal } from "@/lib/energy/calories";
import { formatDuration } from "@/lib/format/time";
import {
  startRecordingForegroundService,
  stopRecordingForegroundService,
} from "@/lib/lifecycle/foreground-service";
import {
  cancelInactivityReminder,
  scheduleInactivityReminder,
} from "@/lib/lifecycle/inactivity-notification";
import { useRecordingKeepAwake } from "@/lib/lifecycle/keep-awake";

/** Recording lifecycle states. The UI flips between primary buttons (Start, Stop, Pause/Resume, Lap, Share) and notice content based on this. */
type RecordingPhase = "armed" | "running" | "paused" | "saving" | "saved";

/**
 * Why a pause was opened, used to decide whether to surface a banner
 * once the user is back in foreground. Auto-pauses (inactivity, iOS
 * background with phone-only motion) are explained on screen so the
 * user understands why we stopped counting on their behalf.
 */
type PauseReason = "user" | "inactivity" | "ios-background-no-sensor";

/** Throttle for the on-disk draft flush loop. */
const DRAFT_FLUSH_INTERVAL_MS = 5_000;

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
  // Safe-area inset for the bottom-docked control bar so the buttons
  // never tuck under the iOS home indicator or Android nav gesture bar.
  const insets = useSafeAreaInsets();

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
  // Reason for the most recent pause, used to surface a banner when
  // the pause was triggered by the app rather than the user. Set on
  // each transition into `paused` and cleared on resume / stop.
  const [pauseReason, setPauseReason] = useState<PauseReason>("user");
  // Banner surfaced after AppState came back to foreground from a
  // background-induced auto-pause. Distinct from `pauseReason` so we
  // can keep the banner up across a manual Resume.
  const [showBackgroundPauseBanner, setShowBackgroundPauseBanner] =
    useState(false);
  // Recovery flow: when we cold-start with a fresh draft on disk,
  // `app/_layout.tsx` navigates to `/free-row?recover=<id>` and we
  // surface a modal letting the user Resume / Save / Discard.
  const params = useLocalSearchParams<{ recover?: string }>();
  const [recoveryDraftId, setRecoveryDraftId] = useState<string | null>(null);

  // Inactivity-reminder opt-in toggle (Settings → Recording). When on,
  // we schedule a local notification after the auto-pause threshold
  // while the app is backgrounded; cancelled on every stroke / on
  // foreground / on stop.
  const { enabled: reminderEnabled } = useInactivityReminderPref();
  const reminderEnabledRef = useRef(false);
  useEffect(() => {
    reminderEnabledRef.current = reminderEnabled === true;
  }, [reminderEnabled]);

  // Auto-start state. The modal is shown when the detector picks up
  // strokes while we're still in `armed` and the user hasn't disabled
  // the feature in Settings. `autoStartSuppressedRef` latches once the
  // user taps Cancel inside the modal so we don't immediately re-arm
  // on the next stroke during the same armed session — it's reset in
  // `resetRecordingDisplay`, i.e. after a discard / save error / save +
  // re-mount, which all naturally signal "fresh attempt".
  const { enabled: autoStartEnabled } = useAutoStartPref();
  const [autoStartModalVisible, setAutoStartModalVisible] = useState(false);
  const autoStartSuppressedRef = useRef(false);

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

  // Arm the auto-start modal on the first detected stroke while still
  // in `armed`. The modal owns the 5 s countdown and decides whether
  // to call `onComplete` (→ `handleStart`) or `onCancel` (→ suppress).
  // Hydration of the user preference is async, so we explicitly check
  // `=== true` to avoid showing the modal before the value loads.
  useEffect(() => {
    if (phase !== "armed") {
      return;
    }
    if (!strokeSession.strokeJustDetected) {
      return;
    }
    if (autoStartEnabled !== true) {
      return;
    }
    if (autoStartSuppressedRef.current) {
      return;
    }
    if (autoStartModalVisible) {
      return;
    }
    setAutoStartModalVisible(true);
  }, [
    phase,
    strokeSession.strokeJustDetected,
    autoStartEnabled,
    autoStartModalVisible,
  ]);

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
    setPauseReason("user");
    setShowBackgroundPauseBanner(false);
    caloriesKcalRef.current = 0;
    caloriesLastTickMsRef.current = null;
    hasSeenHrRef.current = false;
    setCaloriesKcal(null);
    recorderRef.current.start(now);
    setPhase("running");
    // Fire-and-forget: starting the foreground service is async on
    // Android (notifee channel + notification post). The recording
    // itself doesn't depend on the result.
    void startRecordingForegroundService({
      title: t("freeRow.recording.foregroundService.title"),
      body: t("freeRow.recording.foregroundService.body"),
    });
  }, [strokeSession.strokeCount, t]);

  const pauseInternal = useCallback(
    (reason: PauseReason) => {
      const now = Date.now();
      setSessionStrokesAtPauseStart(strokeSession.strokeCount);
      setPauseStartedAtMs(now);
      setNowMs(now);
      setPauseReason(reason);
      recorderRef.current.pause(now);
      setPhase("paused");
    },
    [strokeSession.strokeCount],
  );

  const handlePause = useCallback(() => {
    if (phase !== "running") {
      return;
    }
    pauseInternal("user");
  }, [phase, pauseInternal]);

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
    setPauseReason("user");
    setShowBackgroundPauseBanner(false);
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
  // without resetting the stroke session (calibration persists). Also
  // re-arms the auto-start modal so a discard / save-error → fresh
  // attempt can use the auto-start flow again.
  const resetRecordingDisplay = useCallback(() => {
    setRecordingStartedAtMs(null);
    setPauseStartedAtMs(null);
    setPausedTotalMs(0);
    setStrokesDuringPauses(0);
    setSessionStrokesAtPauseStart(0);
    setLapStartedAtMovingMs(null);
    setPauseReason("user");
    setShowBackgroundPauseBanner(false);
    caloriesKcalRef.current = 0;
    caloriesLastTickMsRef.current = null;
    hasSeenHrRef.current = false;
    setCaloriesKcal(null);
    autoStartSuppressedRef.current = false;
  }, []);

  // Tear-down helper invoked from every code path that finishes the
  // current recording (manual save, discard, auto-save). Clears the
  // on-disk draft, stops the Android foreground service, and cancels
  // any pending inactivity reminder so the user doesn't get a stale
  // notification after the session ended.
  const teardownRecordingSideEffects = useCallback((draftId: string | null) => {
    if (draftId) {
      try {
        deleteDraft(draftId);
      } catch (e) {
        console.warn("[free-row] deleteDraft failed", e);
      }
    }
    void stopRecordingForegroundService();
    void cancelInactivityReminder();
  }, []);

  const handleAutoStartCancel = useCallback(() => {
    setAutoStartModalVisible(false);
    // Latch suppression so we don't immediately re-trigger on the very
    // next stroke. The user can still tap Start manually; the latch is
    // released by `resetRecordingDisplay` on discard / save error / by
    // the screen unmounting after a successful save.
    autoStartSuppressedRef.current = true;
  }, []);

  const handleAutoStartComplete = useCallback(() => {
    setAutoStartModalVisible(false);
    handleStart();
  }, [handleStart]);

  // Finish the recorder and run the FIT save flow. Extracted so both
  // the no-prompt Stop path and the Keep button on the short-activity
  // prompt can share the same transition into the saving / saved /
  // save-error states.
  //
  // `endedReason` propagates to `summary.endedReason` so consumers
  // (FIT note, history filtering) can distinguish a manual stop from
  // an inactivity-driven auto-save or a "Save now" recovery.
  const performStopAndSave = useCallback(
    async (endedReason: "user" | "inactivity-timeout" = "user") => {
      const draftId = recorderRef.current.currentId;
      setPhase("saving");
      try {
        const activity = recorderRef.current.finish(Date.now(), endedReason);
        const stored = await saveActivity(activity);
        setSavedActivity(stored);
        setPhase("saved");
        teardownRecordingSideEffects(draftId);
      } catch (e) {
        console.error("[free-row] save failed", e);
        Alert.alert(
          t("freeRow.recording.saveErrorTitle"),
          t("freeRow.recording.saveErrorBody"),
        );
        setPhase("armed");
        resetRecordingDisplay();
        // We intentionally do NOT delete the draft on save failure;
        // the user might retry from a fresh launch and we'd rather
        // surface the recovery prompt than silently lose the work.
        void stopRecordingForegroundService();
        void cancelInactivityReminder();
      }
    },
    [resetRecordingDisplay, t, teardownRecordingSideEffects],
  );

  // Drop the in-flight recording without saving and reset the screen
  // back to `armed`. Skips its own confirmation alert — used both by
  // the short-activity Keep/Discard prompt (which is itself the
  // confirmation) and by the back-button discard flow below (which
  // wraps it in `Alert.alert`).
  const performDiscard = useCallback(() => {
    const draftId = recorderRef.current.currentId;
    if (recorderRef.current.isRunning) {
      recorderRef.current.abandon();
    }
    setPhase("armed");
    resetRecordingDisplay();
    teardownRecordingSideEffects(draftId);
  }, [resetRecordingDisplay, teardownRecordingSideEffects]);

  // -- Keep-screen-awake --------------------------------------------------
  //
  // Only hold the wake lock while a recording is in flight. The screen
  // is allowed to dim/sleep again as soon as the user stops, saves, or
  // discards — at which point we don't need to keep it on.
  useRecordingKeepAwake(phase === "running" || phase === "paused");

  // -- Draft persistence --------------------------------------------------
  //
  // Flush a JSON snapshot of the recorder to disk every 5 s while a
  // recording is live (running or paused). The recorder owns a `dirty`
  // flag so we skip the disk write when nothing has changed since the
  // last flush. We also flush immediately on AppState transitions to
  // background (see the AppState effect below) so a quick swipe-to-
  // close doesn't lose the last few seconds of strokes.
  useEffect(() => {
    if (phase !== "running" && phase !== "paused") {
      return;
    }
    const flush = () => {
      const recorder = recorderRef.current;
      if (!recorder.isRunning) {
        return;
      }
      if (!recorder.isDirty) {
        return;
      }
      const draft = recorder.serialize({
        motionSource: source === "ble" ? "ble" : "phone",
        uiPhase: recorder.isPaused ? "paused" : "running",
        nowMs: Date.now(),
      });
      if (!draft) {
        return;
      }
      try {
        writeDraft(draft);
        recorder.clearDirty();
      } catch (e) {
        console.warn("[free-row] draft flush failed", e);
      }
    };
    const id = setInterval(flush, DRAFT_FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, source]);

  // -- AppState lifecycle -------------------------------------------------
  //
  // Two responsibilities:
  //   1. Flush the draft on every active → background transition so a
  //      kill / OS swipe doesn't lose the last 5 s of strokes.
  //   2. When the only motion source is the phone accelerometer (no BLE
  //      sensor connected), iOS suspends `expo-sensors` within seconds
  //      of backgrounding. Honest UX is to auto-pause the recording
  //      with a `pausedReason: "ios-background-no-sensor"` instead of
  //      silently dropping samples. When BLE is the source we leave
  //      the recording running — BLE notifications keep JS alive.
  //   3. Schedule the optional inactivity reminder (when opted-in)
  //      while we're backgrounded; cancel it on foreground.
  //
  // Refs mirror state so we don't churn the listener on every change.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const bleMotionConnectedRef = useRef(!!ble.motion.activeDevice);
  bleMotionConnectedRef.current = !!ble.motion.activeDevice;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const recorder = recorderRef.current;
      if (next === "active") {
        // Returning to the foreground: cancel any inactivity
        // reminder that was scheduled to fire while we were away.
        // The 250 ms tick + stroke detection takes over from here.
        void cancelInactivityReminder();
        return;
      }
      if (next !== "background" && next !== "inactive") {
        return;
      }
      // Heading into the background: flush the draft right now so
      // we don't lose any work if iOS / Android kill us.
      if (recorder.isRunning && recorder.isDirty) {
        const draft = recorder.serialize({
          motionSource: sourceRef.current === "ble" ? "ble" : "phone",
          uiPhase: recorder.isPaused ? "paused" : "running",
          nowMs: Date.now(),
        });
        if (draft) {
          try {
            writeDraft(draft);
            recorder.clearDirty();
          } catch (e) {
            console.warn("[free-row] background flush failed", e);
          }
        }
      }
      // Phone-only motion can't keep producing samples in the
      // background on iOS. Auto-pause so the saved activity reflects
      // what actually happened.
      if (
        phaseRef.current === "running" &&
        sourceRef.current === "phone" &&
        !bleMotionConnectedRef.current
      ) {
        pauseInternal("ios-background-no-sensor");
        setShowBackgroundPauseBanner(true);
      }
      // Optional opt-in reminder: wake the user up at the auto-pause
      // threshold so they can come back and save / discard. We
      // schedule from the last detected event rather than now so a
      // long-paused session doesn't double-reminder.
      if (reminderEnabledRef.current && recorder.isRunning) {
        const lastEvent = recorder.lastEventAtMs ?? Date.now();
        const elapsedSinceEvent = Math.max(0, Date.now() - lastEvent);
        const delayMs = Math.max(
          30_000,
          INACTIVITY_AUTO_PAUSE_MS - elapsedSinceEvent,
        );
        void scheduleInactivityReminder({
          delayMs,
          title: t("freeRow.recording.inactivityReminder.title"),
          body: t("freeRow.recording.inactivityReminder.body"),
        });
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [pauseInternal, t]);

  // -- Inactivity policy --------------------------------------------------
  //
  // Watches the recorder for stroke-inactivity:
  //   - phase=running and no stroke for INACTIVITY_AUTO_PAUSE_MS
  //     → auto-pause with `pauseReason: "inactivity"`.
  //   - phase=paused longer than INACTIVITY_AUTO_SAVE_MS → finalize
  //     and save (truncated to the last detected stroke), tagged
  //     with `endedReason: "inactivity-timeout"`.
  //
  // Runs on its own 5 s timer rather than piggy-backing on the 250 ms
  // tick so we don't add a state-read on every render of the metrics
  // card.
  useEffect(() => {
    if (phase !== "running" && phase !== "paused") {
      return;
    }
    const id = setInterval(() => {
      const now = Date.now();
      const recorder = recorderRef.current;
      if (!recorder.isRunning) {
        return;
      }
      if (phaseRef.current === "running") {
        const lastEvent =
          recorder.lastStrokeAtMs ?? recorder.lastEventAtMs ?? now;
        if (now - lastEvent >= INACTIVITY_AUTO_PAUSE_MS) {
          pauseInternal("inactivity");
        }
        return;
      }
      // Paused: check whether we've crossed the auto-save threshold.
      // We only auto-save when the pause was opened by us (not by the
      // user) — a manual Pause should never auto-finalize the session
      // out from under the user.
      if (pauseStartedAtMs == null) {
        return;
      }
      if (pauseReason === "user") {
        return;
      }
      if (now - pauseStartedAtMs < INACTIVITY_AUTO_SAVE_MS) {
        return;
      }
      // Truncate to the last stroke (or last event) before saving so
      // the activity reflects when rowing actually stopped, not when
      // the timeout fired.
      const cutoff = recorder.lastStrokeAtMs ?? recorder.lastEventAtMs;
      if (cutoff != null) {
        recorder.truncateTo(cutoff);
      }
      void performStopAndSave("inactivity-timeout");
    }, 5_000);
    return () => clearInterval(id);
  }, [phase, pauseStartedAtMs, pauseReason, pauseInternal, performStopAndSave]);

  // -- Cold-start recovery ------------------------------------------------
  //
  // The root layout cold-start logic navigates to /free-row?recover=<id>
  // when a fresh draft was found. We mirror the param into local state
  // (since `useLocalSearchParams` returns fresh values on every render)
  // and surface the recovery modal. Tapping Resume / Save now /
  // Discard transitions us back into a normal recorder state.
  useEffect(() => {
    if (typeof params.recover !== "string" || params.recover.length === 0) {
      return;
    }
    if (recorderRef.current.isRunning) {
      // We already restored once this mount; ignore stale param.
      return;
    }
    setRecoveryDraftId(params.recover);
  }, [params.recover]);

  const handleRecoveryResume = useCallback(() => {
    if (!recoveryDraftId) {
      return;
    }
    const draft = loadDraft(recoveryDraftId);
    setRecoveryDraftId(null);
    if (!draft) {
      return;
    }
    recorderRef.current.restoreFrom(draft);
    setRecordingStartedAtMs(draft.startedAtMs);
    // Anchor the display so the existing draft strokes are visible
    // immediately. New strokes detected post-resume add on top.
    setRecordingStartStrokeCount(
      strokeSession.strokeCount - draft.strokes.length,
    );
    setPausedTotalMs(draft.pausedMs);
    setStrokesDuringPauses(0);
    setSessionStrokesAtPauseStart(strokeSession.strokeCount);
    setLapStartedAtMovingMs(null);
    setPauseStartedAtMs(draft.pauseStartedAtMs);
    setPauseReason("user");
    setShowBackgroundPauseBanner(false);
    caloriesKcalRef.current =
      draft.records.length > 0
        ? (draft.records[draft.records.length - 1].caloriesKcal ?? 0)
        : 0;
    caloriesLastTickMsRef.current = null;
    hasSeenHrRef.current = caloriesKcalRef.current > 0;
    setCaloriesKcal(hasSeenHrRef.current ? caloriesKcalRef.current : null);
    setNowMs(Date.now());
    // Resume into `paused` so the user explicitly taps Resume to
    // start counting again. This is more honest than springing
    // straight into running — they may have force-closed because
    // they were done rowing.
    if (!recorderRef.current.isPaused) {
      recorderRef.current.pause(Date.now());
    }
    setPhase("paused");
    void startRecordingForegroundService({
      title: t("freeRow.recording.foregroundService.title"),
      body: t("freeRow.recording.foregroundService.body"),
    });
  }, [recoveryDraftId, strokeSession.strokeCount, t]);

  const handleRecoverySaveNow = useCallback(async () => {
    if (!recoveryDraftId) {
      return;
    }
    const draft = loadDraft(recoveryDraftId);
    setRecoveryDraftId(null);
    if (!draft) {
      return;
    }
    setPhase("saving");
    try {
      recorderRef.current.restoreFrom(draft);
      const cutoff =
        recorderRef.current.lastStrokeAtMs ?? recorderRef.current.lastEventAtMs;
      if (cutoff != null) {
        recorderRef.current.truncateTo(cutoff);
      }
      const finishAt = recorderRef.current.lastEventAtMs ?? draft.lastEventAtMs;
      const activity = recorderRef.current.finish(finishAt, "recovery-save");
      const stored = await saveActivity(activity);
      setSavedActivity(stored);
      setPhase("saved");
      deleteDraft(draft.id);
      teardownRecordingSideEffects(null);
      router.replace("/(tabs)/row");
    } catch (e) {
      console.error("[free-row] recovery save failed", e);
      Alert.alert(
        t("freeRow.recording.saveErrorTitle"),
        t("freeRow.recording.saveErrorBody"),
      );
      setPhase("armed");
      resetRecordingDisplay();
    }
  }, [recoveryDraftId, resetRecordingDisplay, t, teardownRecordingSideEffects]);

  const handleRecoveryDiscard = useCallback(() => {
    if (recoveryDraftId) {
      deleteDraft(recoveryDraftId);
    }
    setRecoveryDraftId(null);
    router.replace("/(tabs)/row");
  }, [recoveryDraftId]);

  const handleStop = useCallback(() => {
    if (!recorderRef.current.isRunning) {
      return;
    }
    // Short-activity guard: a few stray strokes during calibration or
    // an accidental Start tap shouldn't silently land in the user's
    // history. We surface a Keep/Discard prompt naming the specific
    // reason; Cancel leaves the user in their current phase
    // (`running` / `paused`) so they can keep rowing or stop again.
    const reason = classifyShortActivity(
      displayStrokeCount,
      displayTotalTimeSeconds,
    );
    if (reason == null) {
      void performStopAndSave();
      return;
    }
    const bodyKey =
      reason === "both"
        ? "freeRow.recording.shortActivityBodyBoth"
        : reason === "fewStrokes"
          ? "freeRow.recording.shortActivityBodyFewStrokes"
          : "freeRow.recording.shortActivityBodyShortDuration";
    Alert.alert(
      t("freeRow.recording.shortActivityTitle"),
      t(bodyKey, {
        count: displayStrokeCount,
        durationSeconds: Math.round(displayTotalTimeSeconds),
      }),
      [
        {
          text: t("freeRow.recording.shortActivityKeep"),
          onPress: () => {
            void performStopAndSave();
          },
        },
        {
          text: t("freeRow.recording.shortActivityDiscard"),
          style: "destructive",
          onPress: performDiscard,
        },
        { text: t("freeRow.back"), style: "cancel" },
      ],
    );
  }, [
    displayStrokeCount,
    displayTotalTimeSeconds,
    performDiscard,
    performStopAndSave,
    t,
  ]);

  const handleDiscardRunning = useCallback(() => {
    Alert.alert(
      t("freeRow.recording.discardTitle"),
      t("freeRow.recording.discardBody"),
      [
        {
          text: t("freeRow.recording.discard"),
          style: "destructive",
          onPress: performDiscard,
        },
        { text: t("freeRow.back"), style: "cancel" },
      ],
    );
  }, [performDiscard, t]);

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
      {phase === "paused" && pauseReason === "inactivity" ? (
        <Banner
          tone="warning"
          title={t("freeRow.recording.pauseBanners.inactivityTitle")}
        >
          {t("freeRow.recording.pauseBanners.inactivityBody")}
        </Banner>
      ) : null}
      {showBackgroundPauseBanner ? (
        <Banner
          tone="warning"
          title={t("freeRow.recording.pauseBanners.backgroundPhoneTitle")}
        >
          {t("freeRow.recording.pauseBanners.backgroundPhoneBody")}
        </Banner>
      ) : null}
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
            icon="figure.indoor.rowing"
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
          <View style={styles.runningControlsRow}>
            <View style={styles.runningControlsCell}>
              <Button
                title={
                  isPaused
                    ? t("freeRow.recording.resume")
                    : t("freeRow.recording.pause")
                }
                onPress={isPaused ? handleResume : handlePause}
                icon={isPaused ? "play.fill" : "pause.fill"}
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
                icon="flag.fill"
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
            icon="stop.fill"
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
    //
    // Only Share is offered here. The screen-level back affordance lives
    // in the AppHeader (top-leading), which `handleBack` delegates to
    // `router.back()` once we're out of `running`/`paused`. Surfacing a
    // second Back button here in the bottom-right would put the
    // dismiss-and-go-back action where users expect a "Next" / forward
    // action, which is confusing.
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
        <Button
          title={t("freeRow.recording.share")}
          onPress={handleShare}
          icon="square.and.arrow.up"
          tone="accent"
          variant="filled"
          size="lg"
          block
        />
      </View>
    );
  };

  const recordingControls = renderRecordingControls();

  return (
    <ThemedView style={styles.root}>
      <AppHeader
        title={t("freeRow.title")}
        onBack={handleBack}
        backLabel={t("freeRow.back")}
      />
      <View style={styles.body}>{renderDataSection()}</View>
      {recordingControls != null ? (
        <View
          style={[
            styles.controlsDock,
            {
              // Add the device's bottom safe-area inset to our base
              // padding so buttons sit comfortably above the home
              // indicator / nav gesture bar.
              paddingBottom: insets.bottom + 12,
              backgroundColor: tokens.colors.surface,
              borderTopColor: tokens.colors.border,
            },
          ]}
        >
          {recordingControls}
        </View>
      ) : null}
      <AutoStartModal
        visible={autoStartModalVisible}
        onCancel={handleAutoStartCancel}
        onComplete={handleAutoStartComplete}
      />
      <RecoveryPrompt
        draftId={recoveryDraftId}
        onResume={handleRecoveryResume}
        onSaveNow={() => {
          void handleRecoverySaveNow();
        }}
        onDiscard={handleRecoveryDiscard}
      />
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
  // Bottom-pinned dock for primary recording controls. Lives outside
  // `body` so the pause / lap / stop row stays in a predictable place
  // regardless of how tall the metrics card or HR ribbon grow.
  controlsDock: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  controlsBlock: {
    gap: 12,
  },
  controlsHelper: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
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
