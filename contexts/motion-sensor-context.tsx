import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type MotionSensorSource = 'none' | 'phone' | 'ble';

export type MotionSensorSelection = {
  source: MotionSensorSource;
  deviceLabel: string | null;
};

type MotionSensorContextValue = MotionSensorSelection & {
  isHydrated: boolean;
  selectPhone: () => void;
  selectBle: (deviceLabel: string) => void;
  clear: () => void;
};

const STORAGE_KEY = 'rowerm8.motionSensor.selection.v1';

const DEFAULT_SELECTION: MotionSensorSelection = {
  source: 'none',
  deviceLabel: null,
};

const MotionSensorContext = createContext<MotionSensorContextValue | null>(null);

export function MotionSensorProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<MotionSensorSelection>(DEFAULT_SELECTION);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as MotionSensorSelection;
            if (parsed && typeof parsed.source === 'string') {
              setSelection(parsed);
            }
          } catch {
            // Ignore malformed persisted state and fall back to default.
          }
        }
      })
      .catch(() => {
        // Ignore storage errors; we'll just use the default.
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: MotionSensorSelection) => {
    setSelection(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Best-effort persistence; in-memory state still updates.
    });
  }, []);

  const value = useMemo<MotionSensorContextValue>(
    () => ({
      ...selection,
      isHydrated,
      selectPhone: () => persist({ source: 'phone', deviceLabel: 'iPhone accelerometer' }),
      selectBle: (deviceLabel: string) => persist({ source: 'ble', deviceLabel }),
      clear: () => persist(DEFAULT_SELECTION),
    }),
    [selection, isHydrated, persist],
  );

  return <MotionSensorContext.Provider value={value}>{children}</MotionSensorContext.Provider>;
}

export function useMotionSensor() {
  const ctx = useContext(MotionSensorContext);
  if (!ctx) {
    throw new Error('useMotionSensor must be used within a MotionSensorProvider');
  }
  return ctx;
}
