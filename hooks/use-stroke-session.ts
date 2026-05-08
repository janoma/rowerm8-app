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

  useEffect(() => {
    const sample = stream.sample;
    if (!sample) {
      return;
    }
    if (sample === lastSampleRef.current) {
      return;
    }
    lastSampleRef.current = sample;

    // Forward the optional `angle` (BLE / WitMotion) so the projector
    // can subtract gravity properly.
    const next = sessionRef.current.update(
      { x: sample.x, y: sample.y, z: sample.z, angle: sample.angle },
      Date.now(),
    );
    setMetrics(next);
    if (next.strokeCount > previousStrokeCountRef.current) {
      previousStrokeCountRef.current = next.strokeCount;
      setStrokeJustDetected(true);
    }
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
  // source's stream.
  useEffect(() => {
    previousStrokeCountRef.current = 0;
    lastSampleRef.current = null;
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
        setMetrics(INITIAL_METRICS);
        setStrokeJustDetected(false);
      },
    }),
    [metrics, strokeJustDetected],
  );
}
