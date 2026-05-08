import { Accelerometer } from "expo-sensors";
import { useEffect, useMemo, useRef, useState } from "react";

import { gToMps2 } from "@/lib/units";

export type AccelerometerSample = {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  /**
   * Optional Euler angles (degrees) carried alongside the acceleration when
   * the underlying sensor performs on-device sensor fusion. Used downstream
   * to subtract gravity in a stable frame. Always undefined for the phone's
   * raw accelerometer; populated by the BLE WitMotion decoder.
   */
  angle?: { roll: number; pitch: number; yaw: number };
};

export type AxisHistories = {
  x: number[];
  y: number[];
  z: number[];
};

export type AccelerometerStream = {
  sample: AccelerometerSample | null;
  histories: AxisHistories;
  isAvailable: boolean;
  permissionDenied: boolean;
  sampleRateHz: number;
};

const ZERO_SAMPLE: AccelerometerSample = { x: 0, y: 0, z: 0, magnitude: 0 };

const makeEmptyHistory = (length: number): AxisHistories => ({
  x: new Array(length).fill(0),
  y: new Array(length).fill(0),
  z: new Array(length).fill(0),
});

/**
 * Subscribes to expo-sensors Accelerometer while `enabled` is true.
 * Returns the most recent sample (in m/s^2) plus a per-axis ring buffer
 * suitable for rendering one sparkline per axis.
 */
export function useAccelerometerStream({
  enabled,
  sampleRateHz = 60,
  historyLength = 96,
}: {
  enabled: boolean;
  sampleRateHz?: number;
  historyLength?: number;
}): AccelerometerStream {
  const [sample, setSample] = useState<AccelerometerSample | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const historiesRef = useRef<AxisHistories>(makeEmptyHistory(historyLength));
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setSample(null);
      historiesRef.current = makeEmptyHistory(historyLength);
      setHistoryVersion((v) => v + 1);
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (cancelled) {
          return;
        }
        setIsAvailable(available);
        if (!available) {
          return;
        }

        const permission = await Accelerometer.requestPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (!permission.granted) {
          setPermissionDenied(true);
          return;
        }
        setPermissionDenied(false);

        Accelerometer.setUpdateInterval(
          Math.max(1, Math.round(1000 / sampleRateHz)),
        );

        subscription = Accelerometer.addListener((data) => {
          // Sensor reports in "g". Normalize to SI at ingress so everything
          // downstream (charts, decoders, persisted history) works in m/s^2.
          const x = gToMps2(data.x);
          const y = gToMps2(data.y);
          const z = gToMps2(data.z);
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          setSample({ x, y, z, magnitude });

          const buffers = historiesRef.current;
          buffers.x.shift();
          buffers.x.push(x);
          buffers.y.shift();
          buffers.y.push(y);
          buffers.z.shift();
          buffers.z.push(z);
          setHistoryVersion((v) => (v + 1) % 1_000_000);
        });
      } catch {
        if (!cancelled) {
          setIsAvailable(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, sampleRateHz, historyLength]);

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
    isAvailable,
    permissionDenied,
    sampleRateHz,
  };
}
