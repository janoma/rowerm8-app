import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { findDecoder } from "@/decoders/registry";
import type { SensorDecoder } from "@/decoders/types";
// Type-only imports are erased at runtime, so this does not pull the
// react-native-ble-plx native module on platforms (e.g. web) that lack it.
import type {
  BleManager as BleManagerType,
  Device,
  State,
  Subscription,
} from "react-native-ble-plx";

const SCAN_DURATION_MS = 15_000;
const CONNECT_TIMEOUT_MS = 10_000;
// Battery state changes slowly; once a minute is more than enough, and it
// keeps the radio quiet between high-rate accel notifications.
const BATTERY_POLL_INTERVAL_MS = 60_000;
// Wait a beat after the connection is live (and after init writes are queued)
// before the first battery read, so we don't fight iOS for write slots while
// the connection is still warming up.
const BATTERY_FIRST_READ_DELAY_MS = 1_500;
// Verbose protocol-level logging for diagnosing decoder issues. Flip to false
// once the WitMotion battery flow is verified end-to-end.
const BLE_DEBUG_LOGS = true;
// Most verbose logging for individual reads of motion data.
const BLE_TRACE_LOGS = false;

function hexBytes(bytes: Uint8Array, n = 20): string {
  const len = Math.min(n, bytes.length);
  const parts: string[] = [];
  for (let i = 0; i < len; i++) {
    parts.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return (
    parts.join(" ") +
    (bytes.length > len ? ` … (${bytes.length}B total)` : ` (${bytes.length}B)`)
  );
}

let blePlxModule: typeof import("react-native-ble-plx") | null = null;
function loadBlePlx(): typeof import("react-native-ble-plx") | null {
  if (Platform.OS === "web") {
    return null;
  }
  if (blePlxModule) {
    return blePlxModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    blePlxModule = require("react-native-ble-plx");
    return blePlxModule;
  } catch {
    return null;
  }
}

export type BleRole = "motion" | "hr";

export type ScannedDevice = {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  serviceUUIDs: string[] | null;
  decoder: SensorDecoder | null;
};

export type BleAvailability =
  | "unavailable"
  | "unknown"
  | "unauthorized"
  | "off"
  | "on";
export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export type BleSlot = {
  activeDevice: ScannedDevice | null;
  activeDecoder: SensorDecoder | null;
  connectionState: ConnectionState;
  connectionError: string | null;
  /** Last-known battery level for the active device, 0-100. */
  batteryPercent: number | null;
};

const EMPTY_SLOT: BleSlot = {
  activeDevice: null,
  activeDecoder: null,
  connectionState: "idle",
  connectionError: null,
  batteryPercent: null,
};

export type StartScanArgs = {
  role: BleRole;
};

export type BleContextValue = {
  availability: BleAvailability;
  scanning: boolean;
  /** The role the most recent (or current) scan is targeting. */
  scanRole: BleRole | null;
  devices: ScannedDevice[];
  scanError: string | null;
  motion: BleSlot;
  hr: BleSlot;
  /**
   * Lazily create the underlying `BleManager`, which on iOS is what surfaces
   * the system Bluetooth permission prompt. Callers should invoke this from
   * the BLE scan screen *only* — never on app boot — so the user only sees
   * the prompt after they've actively chosen to pair an external sensor.
   *
   * Idempotent: subsequent calls reuse the existing manager. Returns `true`
   * if a manager is now available, `false` if the platform doesn't ship the
   * native module (e.g. web).
   */
  prime: () => boolean;
  startScan: (args: StartScanArgs) => Promise<void>;
  stopScan: () => void;
  connect: (deviceId: string, role: BleRole) => Promise<ScannedDevice | null>;
  disconnect: (role: BleRole) => Promise<void>;
  /** Subscribe to raw notification bytes from the role's active connection. */
  subscribeData: (role: BleRole, cb: (bytes: Uint8Array) => void) => () => void;
};

const BleContext = createContext<BleContextValue | null>(null);

function mapState(s: State | null): BleAvailability {
  if (!s) {
    return "unknown";
  }
  switch (s) {
    case "PoweredOn":
      return "on";
    case "PoweredOff":
      return "off";
    case "Unauthorized":
      return "unauthorized";
    case "Unsupported":
      return "unavailable";
    case "Resetting":
    case "Unknown":
    default:
      return "unknown";
  }
}

// Standard BLE Heart Rate Service. We pass it as a scan filter so iOS/Android
// only surface HR-capable peripherals during an HR-targeted scan, instead of
// flooding the JS layer with every nearby device. Must stay in sync with
// `decoders/heart-rate-standard.ts`. Uses the canonical BLE base UUID
// (...-00805f9b34fb).
const HR_SERVICE_UUID_FILTER = "0000180d-0000-1000-8000-00805f9b34fb";

function toScannedDevice(device: Device, role: BleRole): ScannedDevice {
  const hint = {
    name: device.name,
    localName: device.localName,
    serviceUUIDs: device.serviceUUIDs ?? null,
  };
  return {
    id: device.id,
    name: device.name,
    localName: device.localName,
    rssi: device.rssi ?? null,
    serviceUUIDs: device.serviceUUIDs ?? null,
    decoder: findDecoder(hint, role),
  };
}

function compareDevices(a: ScannedDevice, b: ScannedDevice): number {
  if (a.decoder?.recommended && !b.decoder?.recommended) {
    return -1;
  }
  if (!a.decoder?.recommended && b.decoder?.recommended) {
    return 1;
  }
  const aRssi = a.rssi ?? -200;
  const bRssi = b.rssi ?? -200;
  return bRssi - aRssi;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

type RoleResources = {
  device: Device | null;
  notifySub: Subscription | null;
  batteryTimer: ReturnType<typeof setInterval> | null;
  batteryFirstReadTimeout: ReturnType<typeof setTimeout> | null;
  subscribers: Set<(bytes: Uint8Array) => void>;
};

function emptyResources(): RoleResources {
  return {
    device: null,
    notifySub: null,
    batteryTimer: null,
    batteryFirstReadTimeout: null,
    subscribers: new Set(),
  };
}

const ROLES: BleRole[] = ["motion", "hr"];

export function BleProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<BleManagerType | null>(null);
  const stateSubRef = useRef<Subscription | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-role bookkeeping. Refs (not state) so subscriber lists, native
  // device handles and battery timers survive re-renders without
  // resubscribing the BLE notify characteristic.
  const resourcesRef = useRef<Record<BleRole, RoleResources>>({
    motion: emptyResources(),
    hr: emptyResources(),
  });

  const [availability, setAvailability] = useState<BleAvailability>("unknown");
  const [scanning, setScanning] = useState(false);
  const [scanRole, setScanRole] = useState<BleRole | null>(null);
  const [devices, setDevices] = useState<Record<string, ScannedDevice>>({});
  const [scanError, setScanError] = useState<string | null>(null);
  const [motionSlot, setMotionSlot] = useState<BleSlot>(EMPTY_SLOT);
  const [hrSlot, setHrSlot] = useState<BleSlot>(EMPTY_SLOT);

  const setSlot = useCallback(
    (role: BleRole, updater: (prev: BleSlot) => BleSlot) => {
      if (role === "motion") {
        setMotionSlot(updater);
      } else {
        setHrSlot(updater);
      }
    },
    [],
  );

  const ensureManager = useCallback((): BleManagerType | null => {
    if (managerRef.current) {
      return managerRef.current;
    }
    const mod = loadBlePlx();
    if (!mod) {
      setAvailability("unavailable");
      return null;
    }
    try {
      const manager = new mod.BleManager();
      managerRef.current = manager;
      stateSubRef.current = manager.onStateChange(
        (s) => setAvailability(mapState(s)),
        true,
      );
      return manager;
    } catch {
      setAvailability("unavailable");
      return null;
    }
  }, []);

  const stopScan = useCallback(() => {
    const manager = managerRef.current;
    if (manager) {
      try {
        manager.stopDeviceScan();
      } catch {
        // ignore
      }
    }
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScan = useCallback(
    async ({ role }: StartScanArgs) => {
      const manager = ensureManager();
      if (!manager) {
        setScanError("Bluetooth is not available on this device.");
        return;
      }

      setScanError(null);
      setDevices({});
      setScanRole(role);
      setScanning(true);

      // For hr we filter on the standard Heart Rate service so non-HRMs
      // don't even hit the JS bridge. Motion has no universal advertising
      // signature (each vendor ships a custom service UUID), so we keep
      // scanning everything and rely on the decoder registry to identify
      // matches.
      const filterServices: string[] | null =
        role === "hr" ? [HR_SERVICE_UUID_FILTER] : null;

      try {
        manager.startDeviceScan(
          filterServices,
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              setScanError(error.message ?? "Scan failed.");
              setScanning(false);
              return;
            }
            if (!device) {
              return;
            }
            setDevices((prev) => {
              const existing = prev[device.id];
              const incoming = toScannedDevice(device, role);
              const merged: ScannedDevice = existing
                ? {
                    ...existing,
                    name: incoming.name ?? existing.name,
                    localName: incoming.localName ?? existing.localName,
                    rssi: incoming.rssi ?? existing.rssi,
                    serviceUUIDs:
                      incoming.serviceUUIDs ?? existing.serviceUUIDs,
                    decoder: incoming.decoder ?? existing.decoder,
                  }
                : incoming;
              return { ...prev, [device.id]: merged };
            });
          },
        );

        scanTimerRef.current = setTimeout(() => {
          stopScan();
        }, SCAN_DURATION_MS);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Scan failed.";
        setScanError(message);
        setScanning(false);
      }
    },
    [ensureManager, stopScan],
  );

  const stopBatteryPolling = useCallback((role: BleRole) => {
    const r = resourcesRef.current[role];
    if (r.batteryTimer) {
      clearInterval(r.batteryTimer);
      r.batteryTimer = null;
    }
    if (r.batteryFirstReadTimeout) {
      clearTimeout(r.batteryFirstReadTimeout);
      r.batteryFirstReadTimeout = null;
    }
  }, []);

  const teardownConnection = useCallback(
    async (role: BleRole) => {
      stopBatteryPolling(role);
      const r = resourcesRef.current[role];
      if (r.notifySub) {
        try {
          r.notifySub.remove();
        } catch {
          // ignore
        }
        r.notifySub = null;
      }
      const device = r.device;
      if (device) {
        try {
          await device.cancelConnection();
        } catch {
          // ignore disconnect errors
        }
        r.device = null;
      }
    },
    [stopBatteryPolling],
  );

  const disconnect = useCallback(
    async (role: BleRole) => {
      await teardownConnection(role);
      setSlot(role, () => ({
        activeDevice: null,
        activeDecoder: null,
        connectionState: "disconnected",
        connectionError: null,
        batteryPercent: null,
      }));
    },
    [setSlot, teardownConnection],
  );

  const connect = useCallback(
    async (deviceId: string, role: BleRole): Promise<ScannedDevice | null> => {
      const manager = ensureManager();
      if (!manager) {
        setSlot(role, (prev) => ({
          ...prev,
          connectionError: "Bluetooth is not available on this device.",
          connectionState: "failed",
        }));
        return null;
      }

      stopScan();
      await teardownConnection(role);

      setSlot(role, () => ({
        activeDevice: null,
        activeDecoder: null,
        connectionState: "connecting",
        connectionError: null,
        batteryPercent: null,
      }));

      try {
        const connected = await manager.connectToDevice(deviceId, {
          timeout: CONNECT_TIMEOUT_MS,
        });
        await connected.discoverAllServicesAndCharacteristics();
        const scanned = toScannedDevice(connected, role);
        const decoder = scanned.decoder;
        const r = resourcesRef.current[role];

        if (decoder) {
          r.notifySub = connected.monitorCharacteristicForService(
            decoder.serviceUuid,
            decoder.notifyUuid,
            (error, characteristic) => {
              if (error) {
                setSlot(role, (prev) => ({
                  ...prev,
                  connectionError: error.message ?? "Connection lost.",
                  connectionState: "disconnected",
                }));
                return;
              }
              if (!characteristic?.value) {
                return;
              }
              const bytes = base64ToBytes(characteristic.value);
              r.subscribers.forEach((cb) => cb(bytes));
              // Pull battery responses out of the same notification stream.
              // We rely on the decoder being closed-over here instead of
              // reading state to avoid a stale-decoder race during reconnects.
              const frames = decoder.decode(bytes);
              const batteryFrame = frames.find((f) => f.batteryPercent != null);
              if (batteryFrame?.batteryPercent != null) {
                const percent = batteryFrame.batteryPercent;
                setSlot(role, (prev) => ({ ...prev, batteryPercent: percent }));
              }
              if (BLE_TRACE_LOGS) {
                // Suppress the 25-50 Hz accel chatter: any chunk whose
                // frames are all plain accel (and therefore carry no
                // battery / register-response payload) isn't interesting
                // for protocol-level debugging. iOS commonly coalesces 2-3
                // accel frames per notification, so a length check alone
                // wouldn't be enough.
                const isAllAccel =
                  frames.length > 0 &&
                  frames.every(
                    (f) => f.accel != null && f.batteryPercent == null,
                  );
                if (!isAllAccel) {
                  console.log(
                    "[ble]",
                    role,
                    "notif",
                    hexBytes(bytes),
                    "→ frames:",
                    frames.map((f) => Object.keys(f).join(",")).join(" | "),
                  );
                }
              }
            },
          );
        }

        r.device = connected;
        setSlot(role, () => ({
          activeDevice: scanned,
          activeDecoder: decoder,
          connectionState: "connected",
          connectionError: null,
          batteryPercent: null,
        }));

        // Fire vendor-specific config (e.g. unlock + output rate) AFTER we mark the
        // connection live, so the UI never blocks on these writes. iOS sometimes
        // back-pressures rapid WriteWithoutResponse calls, which previously left
        // the picker stuck on "Connecting...". WriteWithResponse avoids that and
        // surfaces errors; failures are logged but don't affect data flow (the
        // device just stays at its previous settings).
        if (decoder?.writeUuid && decoder.initCommands?.length) {
          const writeUuid = decoder.writeUuid;
          const serviceUuid = decoder.serviceUuid;
          const commands = decoder.initCommands;
          (async () => {
            for (const cmd of commands) {
              try {
                await connected.writeCharacteristicWithResponseForService(
                  serviceUuid,
                  writeUuid,
                  bytesToBase64(cmd),
                );
                // WitMotion's controller needs a small gap between register writes.
                await new Promise((resolve) => setTimeout(resolve, 50));
              } catch (e) {
                console.warn("[ble]", role, "init command failed", e);
              }
            }
          })().catch((e) =>
            console.warn("[ble]", role, "init sequence failed", e),
          );
        }

        // Periodic battery read. We schedule on intervals rather than tying it
        // to the data callback so cadence is independent of the device's
        // output rate (and so it keeps ticking even if the stream stalls).
        if (decoder?.writeUuid && decoder.batteryReadCommand) {
          const writeUuid = decoder.writeUuid;
          const serviceUuid = decoder.serviceUuid;
          const cmd = decoder.batteryReadCommand;
          const writeBattery = async () => {
            const t0 = Date.now();
            if (BLE_DEBUG_LOGS) {
              console.log("[ble]", role, "battery read → write", hexBytes(cmd));
            }
            try {
              await connected.writeCharacteristicWithResponseForService(
                serviceUuid,
                writeUuid,
                bytesToBase64(cmd),
              );
              if (BLE_DEBUG_LOGS) {
                console.log(
                  "[ble]",
                  role,
                  "battery read OK in",
                  Date.now() - t0,
                  "ms (waiting for response on notify)",
                );
              }
            } catch (e) {
              console.warn("[ble]", role, "battery read failed", e);
            }
          };
          r.batteryFirstReadTimeout = setTimeout(() => {
            r.batteryFirstReadTimeout = null;
            writeBattery().catch(() => {});
          }, BATTERY_FIRST_READ_DELAY_MS);
          r.batteryTimer = setInterval(() => {
            writeBattery().catch(() => {});
          }, BATTERY_POLL_INTERVAL_MS);
        }

        return scanned;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to connect.";
        await teardownConnection(role);
        setSlot(role, () => ({
          activeDevice: null,
          activeDecoder: null,
          connectionState: "failed",
          connectionError: message,
          batteryPercent: null,
        }));
        return null;
      }
    },
    [ensureManager, setSlot, stopScan, teardownConnection],
  );

  const subscribeData = useCallback(
    (role: BleRole, cb: (bytes: Uint8Array) => void) => {
      const subs = resourcesRef.current[role].subscribers;
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    [],
  );

  const prime = useCallback((): boolean => {
    return ensureManager() !== null;
  }, [ensureManager]);

  useEffect(() => {
    // We deliberately do NOT instantiate `BleManager` here. Doing so on app
    // boot triggers the iOS `bluetoothAlwaysPermission` system prompt the
    // first time it runs, which is exactly the behavior we're trying to
    // avoid (the user should only be asked when they actively try to pair
    // an external sensor). The manager is created lazily inside
    // `ensureManager()` on the first `startScan` / `connect` call — which
    // means `availability` stays `"unknown"` until the user opens the BLE
    // scan screen, which is the only place that needs it.
    return () => {
      stopScan();
      ROLES.forEach((role) => {
        teardownConnection(role).catch(() => {});
      });
      stateSubRef.current?.remove();
      stateSubRef.current = null;
      const manager = managerRef.current;
      if (manager) {
        try {
          manager.destroy();
        } catch {
          // ignore
        }
        managerRef.current = null;
      }
    };
  }, [stopScan, teardownConnection]);

  const sortedDevices = useMemo(
    () => Object.values(devices).slice().sort(compareDevices),
    [devices],
  );

  const value = useMemo<BleContextValue>(
    () => ({
      availability,
      scanning,
      scanRole,
      devices: sortedDevices,
      scanError,
      motion: motionSlot,
      hr: hrSlot,
      prime,
      startScan,
      stopScan,
      connect,
      disconnect,
      subscribeData,
    }),
    [
      availability,
      scanning,
      scanRole,
      sortedDevices,
      scanError,
      motionSlot,
      hrSlot,
      prime,
      startScan,
      stopScan,
      connect,
      disconnect,
      subscribeData,
    ],
  );

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
}

export function useBle() {
  const ctx = useContext(BleContext);
  if (!ctx) {
    throw new Error("useBle must be used within a BleProvider");
  }
  return ctx;
}
