import { useEffect, useMemo, useRef, useState } from "react";

import { useMotionStream } from "@/hooks/use-motion-stream";
import { magnitudeProjector } from "@/lib/stroke/projector";
import { createStrokeSession } from "@/lib/stroke/session";
import type {
  PaceEstimateOptions,
  SessionMetrics,
  StrokeDetectorConfig,
} from "@/lib/stroke";

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
 * Drive a {@link createStrokeSession} from the unified motion stream.
 *
 * The session itself is held in a ref so the React tree never re-creates
 * it across renders; only the snapshot returned by the most recent
 * `update()` is reactive state. This avoids tearing the detector's EMA /
 * baseline state every time React re-renders for an unrelated reason.
 *
 * Pure-by-construction: there are no side effects (no haptics, no audio).
 * The Row screen will eventually consume `strokeJustDetected` to drive a
 * visual stroke indicator, but that's a UI concern, not this hook's.
 */
export function useStrokeSession(
  options: UseStrokeSessionOptions = {},
): StrokeSessionState {
  const stream = useMotionStream();
  // Memoize the projector + session so they survive re-renders. Detector
  // tuning is captured at construction time; if the caller passes a new
  // `detector` config object on a later render we rebuild — this matches
  // how `useEffect` deps work and keeps the hook predictable.
  const sessionRef = useRef(
    createStrokeSession(magnitudeProjector(), {
      detector: options.detector,
      pace: options.pace,
    }),
  );
  // Track whether the upstream `options` changed in a way that requires
  // rebuilding. Compare by reference for objects; if a caller wants
  // referential stability they can `useMemo` the option block.
  const detectorOptionsRef = useRef(options.detector);
  const paceOptionsRef = useRef(options.pace);
  if (
    detectorOptionsRef.current !== options.detector ||
    paceOptionsRef.current !== options.pace
  ) {
    detectorOptionsRef.current = options.detector;
    paceOptionsRef.current = options.pace;
    sessionRef.current = createStrokeSession(magnitudeProjector(), {
      detector: options.detector,
      pace: options.pace,
    });
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

    const next = sessionRef.current.update(
      { x: sample.x, y: sample.y, z: sample.z },
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

  // Reset metrics + the underlying session when the source changes (e.g.
  // user switches from phone to BLE), so the count / elapsed counter
  // doesn't carry over a previous stream's data.
  const sourceRef = useRef(stream.source);
  useEffect(() => {
    if (sourceRef.current === stream.source) {
      return;
    }
    sourceRef.current = stream.source;
    sessionRef.current.reset();
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
