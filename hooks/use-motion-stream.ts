import { useBle } from "@/contexts/ble-context";
import { useMotionSensor } from "@/contexts/motion-sensor-context";
import type {
  AccelerometerStream,
  AxisHistories,
} from "@/hooks/use-accelerometer-stream";
import { useAccelerometerStream } from "@/hooks/use-accelerometer-stream";
import { useBleStream } from "@/hooks/use-ble-stream";
import type { MotionSensorSource } from "@/contexts/motion-sensor-context";

const EMPTY_HISTORIES: AxisHistories = { x: [], y: [], z: [] };

export type MotionStream = AccelerometerStream & {
  source: MotionSensorSource;
  hasDecoder: boolean;
};

/**
 * Unified motion data source. Internally calls both the phone and BLE hooks
 * (the inactive one is a no-op) and returns the active one's data, plus a few
 * extra fields the UI needs to render no-decoder / source-aware states.
 */
export function useMotionStream(): MotionStream {
  const { source } = useMotionSensor();
  const phone = useAccelerometerStream({ enabled: source === "phone" });
  const ble = useBleStream({ enabled: source === "ble" });
  const { motion } = useBle();

  if (source === "phone") {
    return { ...phone, source, hasDecoder: true };
  }
  if (source === "ble") {
    return { ...ble, source, hasDecoder: !!motion.activeDecoder };
  }
  return {
    sample: null,
    histories: EMPTY_HISTORIES,
    isAvailable: true,
    permissionDenied: false,
    sampleRateHz: 0,
    source,
    hasDecoder: false,
  };
}
