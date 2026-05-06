import { useEffect, useMemo, useRef, useState } from "react";

import { useBle } from "@/contexts/ble-context";
import type {
  AccelerometerSample,
  AccelerometerStream,
  AxisHistories,
} from "@/hooks/use-accelerometer-stream";

const ZERO_SAMPLE: AccelerometerSample = { x: 0, y: 0, z: 0, magnitude: 0 };

const makeEmptyHistory = (length: number): AxisHistories => ({
  x: new Array(length).fill(0),
  y: new Array(length).fill(0),
  z: new Array(length).fill(0),
});

/**
 * Subscribes to the active BLE device's notification stream, decodes it via
 * the active decoder, and exposes the same shape as useAccelerometerStream so
 * the live UI does not need to branch on source.
 */
export function useBleStream({
  enabled,
  historyLength = 96,
}: {
  enabled: boolean;
  historyLength?: number;
}): AccelerometerStream {
  const { activeDecoder, subscribeData, connectionState } = useBle();
  const [sample, setSample] = useState<AccelerometerSample | null>(null);
  const historiesRef = useRef<AxisHistories>(makeEmptyHistory(historyLength));
  const [historyVersion, setHistoryVersion] = useState(0);
  const recentSampleTimes = useRef<number[]>([]);
  const [sampleRateHz, setSampleRateHz] = useState(0);

  useEffect(() => {
    if (!enabled || !activeDecoder) {
      setSample(null);
      historiesRef.current = makeEmptyHistory(historyLength);
      setHistoryVersion((v) => v + 1);
      setSampleRateHz(0);
      recentSampleTimes.current = [];
      return;
    }

    const unsubscribe = subscribeData((bytes) => {
      const frames = activeDecoder.decode(bytes);
      if (!frames.length) {
        return;
      }

      const buffers = historiesRef.current;
      let lastAccel: AccelerometerSample | null = null;
      let count = 0;

      for (const frame of frames) {
        if (!frame.accel) {
          continue;
        }
        lastAccel = frame.accel;
        count += 1;
        buffers.x.shift();
        buffers.x.push(frame.accel.x);
        buffers.y.shift();
        buffers.y.push(frame.accel.y);
        buffers.z.shift();
        buffers.z.push(frame.accel.z);
      }

      if (lastAccel) {
        setSample(lastAccel);
        setHistoryVersion((v) => (v + 1) % 1_000_000);
      }

      if (count > 0) {
        const now = Date.now();
        const arr = recentSampleTimes.current;
        for (let i = 0; i < count; i++) {
          arr.push(now);
        }
        const cutoff = now - 1000;
        while (arr.length && arr[0] < cutoff) {
          arr.shift();
        }
        setSampleRateHz(arr.length);
      }
    });

    return unsubscribe;
  }, [enabled, activeDecoder, subscribeData, historyLength]);

  // historyVersion is the trigger here; the actual data lives in historiesRef,
  // so eslint can't see the dependency relationship.
  const histories = useMemo<AxisHistories>(
    () => ({
      x: historiesRef.current.x.slice(),
      y: historiesRef.current.y.slice(),
      z: historiesRef.current.z.slice(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  );

  return {
    sample: sample ?? (enabled ? ZERO_SAMPLE : null),
    histories,
    isAvailable: connectionState === "connected",
    permissionDenied: false,
    sampleRateHz,
  };
}
