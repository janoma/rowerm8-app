import { useEffect, useMemo, useRef, useState } from "react";

import { useMotionStream } from "@/hooks/use-motion-stream";
import {
  handleAxisProjector,
  magnitudeProjector,
} from "@/lib/stroke/projector";
import { createStrokeSession } from "@/lib/stroke/session";
import type { Projector } from "@/lib/stroke/types";
import type {
  PaceEstimateOptions,
  SessionMetrics,
  StrokeDetectorConfig,
  StrokeSession,
} from "@/lib/stroke";
import type { MotionSensorSource } from "@/contexts/motion-sensor-context";

export type UseStrokeSessionOptions = {
  /** Override any subset of detector tuning. */
  detector?: Partial<StrokeDetectorConfig>;
  /** Pace estimation options (e.g. per-user `metersPerStroke`). */
  pace?: PaceEstimateOptions;
};

export type StrokeSessionState = SessionMetrics & {
  /** Becomes true on the rising edge of every detected stroke. The hook
   * keeps the flag true for one render then clears it; consumers can use
   * `useEffect` on `strokeJustDetected` to drive visual cues without
   * latching. */
  strokeJustDetected: boolean;
  /** Manually clear the session (count / cadence / elapsed). The detector
   * and projector keep running on subsequent samples. */
  reset: () => void;
};

const INITIAL_METRICS: SessionMetrics = {
  strokeCount: 0,
  cadenceSpm: 0,
  instantCadenceSpm: 0,
  boatSpeedMps: 0,
  paceSecondsPer500m: Number.POSITIVE_INFINITY,
  elapsedSeconds: 0,
  threshold: 0,
  baseline: 0,
  isReady: false,
};

/**
 * Wall-clock window after a session starts (or is reset) during which we
 * silently drop any strokes the detector reports. The PCA / EMA state
 * machines need a moment to settle when the projector first boots up;
 * without this gate, a baseline that hasn't yet caught up with gravity
 * can leak across the dynamic threshold and register a phantom "first
 * stroke" the moment the user opens the screen. 1500 ms is roughly 3×
 * the PCA warmup at 50 Hz, which empirically swallows the settling
 * transient without eating real strokes (real rowing strokes don't fire
 * back-to-back at <1 s gaps anyway).
 */
const STARTUP_IGNORE_WINDOW_MS = 1500;

/**
 * Pick the projector best suited for the active motion source.
 *
 *   - `"ble"`: WitMotion handle. Use `handleAxisProjector` so we can
 *     subtract gravity using the on-device Euler attitude and project
 *     onto the PCA-fitted pull axis.
 *   - `"phone"`: phone-on-holder. We currently fall back to
 *     `magnitudeProjector`; the phone path will get its own gravity
 *     correction (via `expo-sensors` `DeviceMotion`) when we re-enable
 *     it for end users.
 *   - `"none"`: no live source; the projector is unused but we still
 *     return one so the session is constructable.
 */
function projectorForSource(source: MotionSensorSource): Projector {
  if (source === "ble") {
    return handleAxisProjector();
  }
  return magnitudeProjector();
}

function buildSession(
  source: MotionSensorSource,
  options: UseStrokeSessionOptions,
): StrokeSession {
  return createStrokeSession(projectorForSource(source), {
    detector: options.detector,
    pace: options.pace,
  });
}

/**
 * Drive a {@link createStrokeSession} from the unified motion stream.
 *
 * The session itself is held in a ref so the React tree never re-creates
 * it across renders; only the snapshot returned by the most recent
 * `update()` is reactive state. This avoids tearing the detector's EMA /
 * baseline state every time React re-renders for an unrelated reason.
 *
 * The session is rebuilt (with a fresh projector that matches the new
 * source) whenever the source changes, so a switch from phone to BLE
 * doesn't carry a stale magnitude-rest baseline into the handle path.
 *
 * Startup ignore window
 * ---------------------
 * Strokes the detector reports during the first {@link
 * STARTUP_IGNORE_WINDOW_MS} of a fresh session are silently suppressed
 * (they don't bump `strokeCount` and don't raise `strokeJustDetected`).
 * This shields the UI from the projector's settling transient — without
 * the gate, opening the Row screen with the phone resting on a desk can
 * register a phantom "first stroke" before the user has done anything.
 * The gate re-arms whenever the session is rebuilt (source change) or
 * the consumer calls {@link StrokeSessionState.reset}.
 *
 * Pure-by-construction: there are no side effects (no haptics, no audio).
 * The Row screen will eventually consume `strokeJustDetected` to drive a
 * visual stroke indicator, but that's a UI concern, not this hook's.
 */
export function useStrokeSession(
  options: UseStrokeSessionOptions = {},
): StrokeSessionState {
  const stream = useMotionStream();

  const sessionRef = useRef<StrokeSession>(
    buildSession(stream.source, options),
  );
  const sourceRef = useRef(stream.source);
  // Compare option objects by reference; if a caller wants referential
  // stability they can `useMemo` the option block.
  const detectorOptionsRef = useRef(options.detector);
  const paceOptionsRef = useRef(options.pace);

  const optionsChanged =
    detectorOptionsRef.current !== options.detector ||
    paceOptionsRef.current !== options.pace;
  const sourceChanged = sourceRef.current !== stream.source;
  if (optionsChanged || sourceChanged) {
    detectorOptionsRef.current = options.detector;
    paceOptionsRef.current = options.pace;
    sourceRef.current = stream.source;
    sessionRef.current = buildSession(stream.source, options);
  }

  const [metrics, setMetrics] = useState<SessionMetrics>(INITIAL_METRICS);
  const [strokeJustDetected, setStrokeJustDetected] = useState(false);
  // Track the last sample we've already pushed into the session so we
  // don't double-process it (useMotionStream returns the same object
  // across renders until a new sample arrives).
  const lastSampleRef = useRef<unknown>(null);
  const previousStrokeCountRef = useRef(0);
  // Wall-clock timestamp of the first sample fed into the current
  // session instance. Used to gate the startup-ignore window. Reset to
  // `null` whenever the session is rebuilt or `reset()` is called.
  const sessionStartMsRef = useRef<number | null>(null);
  // Number of strokes the detector has reported that we silently
  // suppressed because they fell inside the startup window. The hook
  // subtracts this from the metrics it publishes so consumers see a
  // strokeCount that starts at zero on session start.
  const warmupSuppressedStrokesRef = useRef(0);

  useEffect(() => {
    const sample = stream.sample;
    if (!sample) {
      return;
    }
    if (sample === lastSampleRef.current) {
      return;
    }
    lastSampleRef.current = sample;

    const now = Date.now();
    if (sessionStartMsRef.current == null) {
      sessionStartMsRef.current = now;
    }
    const inWarmup = now - sessionStartMsRef.current < STARTUP_IGNORE_WINDOW_MS;

    // Forward the optional `angle` (BLE / WitMotion) so the projector
    // can subtract gravity properly.
    const next = sessionRef.current.update(
      { x: sample.x, y: sample.y, z: sample.z, angle: sample.angle },
      now,
    );

    if (next.strokeCount > previousStrokeCountRef.current) {
      const newStrokes = next.strokeCount - previousStrokeCountRef.current;
      previousStrokeCountRef.current = next.strokeCount;
      if (inWarmup) {
        warmupSuppressedStrokesRef.current += newStrokes;
      } else {
        setStrokeJustDetected(true);
      }
    }

    // Publish the suppressed-adjusted stroke count so consumers never see
    // the warmup-window phantom strokes. `Math.max(0, …)` defends against
    // a hypothetical race where the suppression count outpaces the raw
    // count (shouldn't happen, but cheap to guard).
    setMetrics({
      ...next,
      strokeCount: Math.max(
        0,
        next.strokeCount - warmupSuppressedStrokesRef.current,
      ),
    });
  }, [stream.sample]);

  // Auto-clear strokeJustDetected one tick after it fires so consumers
  // observe a true "edge" rather than a level.
  useEffect(() => {
    if (!strokeJustDetected) {
      return;
    }
    const id = setTimeout(() => setStrokeJustDetected(false), 0);
    return () => clearTimeout(id);
  }, [strokeJustDetected]);

  // When the source changes, the session has already been rebuilt above
  // (during render). Sync the public counters / "last sample" so we
  // don't carry stroke counts or stale sample identity into the new
  // source's stream. We also re-anchor the startup-ignore window: the
  // freshly-built projector needs another settling window of its own.
  useEffect(() => {
    previousStrokeCountRef.current = 0;
    lastSampleRef.current = null;
    sessionStartMsRef.current = null;
    warmupSuppressedStrokesRef.current = 0;
    setMetrics(INITIAL_METRICS);
    setStrokeJustDetected(false);
  }, [stream.source]);

  return useMemo<StrokeSessionState>(
    () => ({
      ...metrics,
      strokeJustDetected,
      reset: () => {
        sessionRef.current.reset();
        previousStrokeCountRef.current = 0;
        lastSampleRef.current = null;
        sessionStartMsRef.current = null;
        warmupSuppressedStrokesRef.current = 0;
        setMetrics(INITIAL_METRICS);
        setStrokeJustDetected(false);
      },
    }),
    [metrics, strokeJustDetected],
  );
}
