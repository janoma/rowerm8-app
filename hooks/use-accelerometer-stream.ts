import { Accelerometer } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';

const G = 9.80665;

export type AccelerometerSample = {
  x: number;
  y: number;
  z: number;
  magnitude: number;
};

export type AccelerometerStream = {
  sample: AccelerometerSample | null;
  history: number[];
  isAvailable: boolean;
  permissionDenied: boolean;
  sampleRateHz: number;
};

const ZERO_SAMPLE: AccelerometerSample = { x: 0, y: 0, z: 0, magnitude: 0 };

/**
 * Subscribes to expo-sensors Accelerometer while `enabled` is true.
 * Returns the most recent sample (in m/s^2) and a fixed-length ring buffer
 * of the magnitude minus gravity, useful for plotting a sparkline.
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
  const historyRef = useRef<number[]>(new Array(historyLength).fill(0));
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setSample(null);
      historyRef.current = new Array(historyLength).fill(0);
      setHistoryVersion((v) => v + 1);
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (cancelled) return;
        setIsAvailable(available);
        if (!available) return;

        const permission = await Accelerometer.requestPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setPermissionDenied(true);
          return;
        }
        setPermissionDenied(false);

        Accelerometer.setUpdateInterval(Math.max(1, Math.round(1000 / sampleRateHz)));

        subscription = Accelerometer.addListener((data) => {
          const x = data.x * G;
          const y = data.y * G;
          const z = data.z * G;
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          setSample({ x, y, z, magnitude });

          const next = historyRef.current;
          next.shift();
          next.push(magnitude - G);
          historyRef.current = next;
          setHistoryVersion((v) => (v + 1) % 1_000_000);
        });
      } catch {
        if (!cancelled) setIsAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, sampleRateHz, historyLength]);

  // historyVersion is the trigger here; the actual data lives in historyRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => historyRef.current.slice(), [historyVersion]);

  return {
    sample: sample ?? (enabled ? ZERO_SAMPLE : null),
    history,
    isAvailable,
    permissionDenied,
    sampleRateHz,
  };
}
