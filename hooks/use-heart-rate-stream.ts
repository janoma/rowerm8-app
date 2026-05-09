import { useEffect, useMemo, useRef, useState } from "react";

import { useBle } from "@/contexts/ble-context";
import { useHeartRate } from "@/contexts/heart-rate-context";

const HISTORY_LENGTH = 60;

export type HeartRateStream = {
  /** Most recent heart rate in bpm, or null if no reading yet. */
  bpm: number | null;
  /** True once at least one HR reading has arrived this connection. */
  hasReading: boolean;
  /**
   * Rolling window of the most recent BPM samples (newest last). Length
   * grows up to {@link HISTORY_LENGTH}, after which it slides.
   */
  bpmHistory: number[];
  /** R-R intervals (ms) from the most recent frame, or empty if not reported. */
  latestRrIntervalsMs: number[];
};

/**
 * Subscribe to the BLE notify stream for the HR slot, decode each frame, and
 * expose the latest BPM (plus a small history) to React. Returns nulls/empties
 * when no HR source is selected or the connection is dormant.
 */
export function useHeartRateStream(): HeartRateStream {
  const { source } = useHeartRate();
  const { hr, subscribeData } = useBle();
  const activeDecoder = hr.activeDecoder;
  const enabled = source === "ble" && !!activeDecoder;

  const [bpm, setBpm] = useState<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [latestRrIntervalsMs, setLatestRrIntervalsMs] = useState<number[]>([]);

  useEffect(() => {
    if (!enabled || !activeDecoder) {
      setBpm(null);
      historyRef.current = [];
      setHistoryVersion((v) => (v + 1) % 1_000_000);
      setLatestRrIntervalsMs([]);
      return;
    }

    const unsubscribe = subscribeData("hr", (bytes) => {
      const frames = activeDecoder.decode(bytes);
      let lastBpm: number | null = null;
      let lastRr: number[] | null = null;
      for (const frame of frames) {
        if (frame.heartRateBpm != null) {
          lastBpm = frame.heartRateBpm;
          historyRef.current.push(frame.heartRateBpm);
          if (historyRef.current.length > HISTORY_LENGTH) {
            historyRef.current.shift();
          }
        }
        if (frame.rrIntervalsMs && frame.rrIntervalsMs.length) {
          lastRr = frame.rrIntervalsMs;
        }
      }
      if (lastBpm != null) {
        setBpm(lastBpm);
        setHistoryVersion((v) => (v + 1) % 1_000_000);
      }
      if (lastRr) {
        setLatestRrIntervalsMs(lastRr);
      }
    });

    return unsubscribe;
  }, [enabled, activeDecoder, subscribeData]);

  // historyVersion is the trigger; the underlying buffer lives in the ref.
  const bpmHistory = useMemo<number[]>(
    () => historyRef.current.slice(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  );

  return {
    bpm,
    hasReading: bpm != null,
    bpmHistory,
    latestRrIntervalsMs,
  };
}
