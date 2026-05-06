import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type MotionSensorSource = "none" | "phone" | "ble";

export type MotionSensorSelection = {
  source: MotionSensorSource;
  deviceLabel: string | null;
  bleDeviceId: string | null;
  decoderKey: string | null;
};

export type SelectBleArgs = {
  deviceLabel: string;
  bleDeviceId: string;
  decoderKey: string | null;
};

type MotionSensorContextValue = MotionSensorSelection & {
  isHydrated: boolean;
  selectPhone: () => void;
  selectBle: (args: SelectBleArgs) => void;
  clear: () => void;
};

const STORAGE_KEY = "rowerm8.motionSensor.selection.v2";

const DEFAULT_SELECTION: MotionSensorSelection = {
  source: "none",
  deviceLabel: null,
  bleDeviceId: null,
  decoderKey: null,
};

const MotionSensorContext = createContext<MotionSensorContextValue | null>(
  null,
);

export function MotionSensorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selection, setSelection] =
    useState<MotionSensorSelection>(DEFAULT_SELECTION);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) {
          return;
        }
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<MotionSensorSelection>;
            if (parsed && typeof parsed.source === "string") {
              // BLE selections are NOT auto-reconnected on app launch yet, so
              // a hydrated 'ble' source would just show a stale device name
              // next to a non-functional UI. Until auto-reconnect lands, drop
              // any persisted BLE selection on cold start so the screen
              // matches the post-disconnect state. Phone selections are safe
              // to restore because expo-sensors transparently re-subscribes.
              if (parsed.source === "ble") {
                setSelection(DEFAULT_SELECTION);
                AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
              } else {
                setSelection({ ...DEFAULT_SELECTION, ...parsed });
              }
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
        if (!cancelled) {
          setIsHydrated(true);
        }
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
      // Phone selections leave `deviceLabel` null on purpose — the UI fills in
      // a localized label at render time so it follows the current language.
      selectPhone: () =>
        persist({
          source: "phone",
          deviceLabel: null,
          bleDeviceId: null,
          decoderKey: null,
        }),
      selectBle: ({ deviceLabel, bleDeviceId, decoderKey }: SelectBleArgs) =>
        persist({ source: "ble", deviceLabel, bleDeviceId, decoderKey }),
      clear: () => persist(DEFAULT_SELECTION),
    }),
    [selection, isHydrated, persist],
  );

  return (
    <MotionSensorContext.Provider value={value}>
      {children}
    </MotionSensorContext.Provider>
  );
}

export function useMotionSensor() {
  const ctx = useContext(MotionSensorContext);
  if (!ctx) {
    throw new Error(
      "useMotionSensor must be used within a MotionSensorProvider",
    );
  }
  return ctx;
}
