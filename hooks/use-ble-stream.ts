import { useEffect, useMemo, useRef, useState } from 'react';

import { useBle } from '@/contexts/ble-context';
import type {
  AccelerometerSample,
  AccelerometerStream,
  AxisHistories,
} from '@/hooks/use-accelerometer-stream';

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
      const frame = activeDecoder.decode(bytes);
      if (!frame?.accel) return;

      setSample(frame.accel);

      const buffers = historiesRef.current;
      buffers.x.shift();
      buffers.x.push(frame.accel.x);
      buffers.y.shift();
      buffers.y.push(frame.accel.y);
      buffers.z.shift();
      buffers.z.push(frame.accel.z);
      setHistoryVersion((v) => (v + 1) % 1_000_000);

      const now = Date.now();
      const arr = recentSampleTimes.current;
      arr.push(now);
      const cutoff = now - 1000;
      while (arr.length && arr[0] < cutoff) arr.shift();
      setSampleRateHz(arr.length);
    });

    return unsubscribe;
  }, [enabled, activeDecoder, subscribeData, historyLength]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const histories = useMemo<AxisHistories>(
    () => ({
      x: historiesRef.current.x.slice(),
      y: historiesRef.current.y.slice(),
      z: historiesRef.current.z.slice(),
    }),
    [historyVersion],
  );

  return {
    sample: sample ?? (enabled ? ZERO_SAMPLE : null),
    histories,
    isAvailable: connectionState === 'connected',
    permissionDenied: false,
    sampleRateHz,
  };
}
