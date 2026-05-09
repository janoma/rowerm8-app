import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type HeartRateSource = "none" | "ble";

export type HeartRateSelection = {
  source: HeartRateSource;
  deviceLabel: string | null;
  bleDeviceId: string | null;
  decoderKey: string | null;
};

export type SelectHrArgs = {
  deviceLabel: string;
  bleDeviceId: string;
  decoderKey: string | null;
};

type HeartRateContextValue = HeartRateSelection & {
  isHydrated: boolean;
  selectBle: (args: SelectHrArgs) => void;
  clear: () => void;
};

const STORAGE_KEY = "rowerm8.heartRateMonitor.selection.v1";

const DEFAULT_SELECTION: HeartRateSelection = {
  source: "none",
  deviceLabel: null,
  bleDeviceId: null,
  decoderKey: null,
};

const HeartRateContext = createContext<HeartRateContextValue | null>(null);

export function HeartRateProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] =
    useState<HeartRateSelection>(DEFAULT_SELECTION);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) {
          return;
        }
        if (!raw) {
          return;
        }
        try {
          const parsed = JSON.parse(raw) as Partial<HeartRateSelection>;
          if (parsed && typeof parsed.source === "string") {
            // Mirror motion-sensor-context: BLE is not auto-reconnected on
            // cold start yet, so a hydrated 'ble' selection would just show
            // a stale device name. Drop it on launch until auto-reconnect
            // lands.
            if (parsed.source === "ble") {
              setSelection(DEFAULT_SELECTION);
              AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
            } else {
              setSelection({ ...DEFAULT_SELECTION, ...parsed });
            }
          }
        } catch {
          // Ignore malformed persisted state.
        }
      })
      .catch(() => {
        // Ignore storage errors; default selection stands.
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: HeartRateSelection) => {
    setSelection(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<HeartRateContextValue>(
    () => ({
      ...selection,
      isHydrated,
      selectBle: ({ deviceLabel, bleDeviceId, decoderKey }: SelectHrArgs) =>
        persist({ source: "ble", deviceLabel, bleDeviceId, decoderKey }),
      clear: () => persist(DEFAULT_SELECTION),
    }),
    [selection, isHydrated, persist],
  );

  return (
    <HeartRateContext.Provider value={value}>
      {children}
    </HeartRateContext.Provider>
  );
}

export function useHeartRate() {
  const ctx = useContext(HeartRateContext);
  if (!ctx) {
    throw new Error("useHeartRate must be used within a HeartRateProvider");
  }
  return ctx;
}
