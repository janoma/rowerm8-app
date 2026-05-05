import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import type { SensorDecoder } from '@/decoders/types';
import { findDecoder } from '@/decoders/registry';
// Type-only imports are erased at runtime, so this does not pull the
// react-native-ble-plx native module on platforms (e.g. web) that lack it.
import type {
  BleManager as BleManagerType,
  Device,
  State,
  Subscription,
} from 'react-native-ble-plx';

const SCAN_DURATION_MS = 15_000;
const CONNECT_TIMEOUT_MS = 10_000;

let blePlxModule: typeof import('react-native-ble-plx') | null = null;
function loadBlePlx(): typeof import('react-native-ble-plx') | null {
  if (Platform.OS === 'web') return null;
  if (blePlxModule) return blePlxModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    blePlxModule = require('react-native-ble-plx');
    return blePlxModule;
  } catch {
    return null;
  }
}

export type ScannedDevice = {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  serviceUUIDs: string[] | null;
  decoder: SensorDecoder | null;
};

export type BleAvailability = 'unavailable' | 'unknown' | 'unauthorized' | 'off' | 'on';
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export type BleContextValue = {
  availability: BleAvailability;
  scanning: boolean;
  devices: ScannedDevice[];
  scanError: string | null;
  activeDevice: ScannedDevice | null;
  activeDecoder: SensorDecoder | null;
  connectionState: ConnectionState;
  connectionError: string | null;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connect: (deviceId: string) => Promise<ScannedDevice | null>;
  disconnect: () => Promise<void>;
  /** Subscribe to raw notification bytes from the active connection. */
  subscribeData: (cb: (bytes: Uint8Array) => void) => () => void;
};

const BleContext = createContext<BleContextValue | null>(null);

function mapState(s: State | null): BleAvailability {
  if (!s) return 'unknown';
  switch (s) {
    case 'PoweredOn':
      return 'on';
    case 'PoweredOff':
      return 'off';
    case 'Unauthorized':
      return 'unauthorized';
    case 'Unsupported':
      return 'unavailable';
    case 'Resetting':
    case 'Unknown':
    default:
      return 'unknown';
  }
}

function toScannedDevice(device: Device): ScannedDevice {
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
    decoder: findDecoder(hint),
  };
}

function compareDevices(a: ScannedDevice, b: ScannedDevice): number {
  if (a.decoder?.recommended && !b.decoder?.recommended) return -1;
  if (!a.decoder?.recommended && b.decoder?.recommended) return 1;
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
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

export function BleProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<BleManagerType | null>(null);
  const stateSubRef = useRef<Subscription | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifySubRef = useRef<Subscription | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null);
  const subscribersRef = useRef<Set<(bytes: Uint8Array) => void>>(new Set());

  const [availability, setAvailability] = useState<BleAvailability>('unknown');
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, ScannedDevice>>({});
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<ScannedDevice | null>(null);
  const [activeDecoder, setActiveDecoder] = useState<SensorDecoder | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const ensureManager = useCallback((): BleManagerType | null => {
    if (managerRef.current) return managerRef.current;
    const mod = loadBlePlx();
    if (!mod) {
      setAvailability('unavailable');
      return null;
    }
    try {
      const manager = new mod.BleManager();
      managerRef.current = manager;
      stateSubRef.current = manager.onStateChange((s) => setAvailability(mapState(s)), true);
      return manager;
    } catch {
      setAvailability('unavailable');
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

  const startScan = useCallback(async () => {
    const manager = ensureManager();
    if (!manager) {
      setScanError('Bluetooth is not available on this device.');
      return;
    }

    setScanError(null);
    setDevices({});
    setScanning(true);

    try {
      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          setScanError(error.message ?? 'Scan failed.');
          setScanning(false);
          return;
        }
        if (!device) return;
        setDevices((prev) => {
          const existing = prev[device.id];
          const incoming = toScannedDevice(device);
          const merged: ScannedDevice = existing
            ? {
                ...existing,
                name: incoming.name ?? existing.name,
                localName: incoming.localName ?? existing.localName,
                rssi: incoming.rssi ?? existing.rssi,
                serviceUUIDs: incoming.serviceUUIDs ?? existing.serviceUUIDs,
                decoder: incoming.decoder ?? existing.decoder,
              }
            : incoming;
          return { ...prev, [device.id]: merged };
        });
      });

      scanTimerRef.current = setTimeout(() => {
        stopScan();
      }, SCAN_DURATION_MS);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Scan failed.';
      setScanError(message);
      setScanning(false);
    }
  }, [ensureManager, stopScan]);

  const teardownConnection = useCallback(async () => {
    if (notifySubRef.current) {
      try {
        notifySubRef.current.remove();
      } catch {
        // ignore
      }
      notifySubRef.current = null;
    }
    const device = connectedDeviceRef.current;
    if (device) {
      try {
        await device.cancelConnection();
      } catch {
        // ignore disconnect errors
      }
      connectedDeviceRef.current = null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await teardownConnection();
    setActiveDevice(null);
    setActiveDecoder(null);
    setConnectionState('disconnected');
    setConnectionError(null);
  }, [teardownConnection]);

  const connect = useCallback(
    async (deviceId: string): Promise<ScannedDevice | null> => {
      const manager = ensureManager();
      if (!manager) {
        setConnectionError('Bluetooth is not available on this device.');
        setConnectionState('failed');
        return null;
      }

      stopScan();
      await teardownConnection();

      setConnectionState('connecting');
      setConnectionError(null);

      try {
        const connected = await manager.connectToDevice(deviceId, {
          timeout: CONNECT_TIMEOUT_MS,
        });
        await connected.discoverAllServicesAndCharacteristics();
        const scanned = toScannedDevice(connected);
        const decoder = scanned.decoder;

        if (decoder) {
          notifySubRef.current = connected.monitorCharacteristicForService(
            decoder.serviceUuid,
            decoder.notifyUuid,
            (error, characteristic) => {
              if (error) {
                setConnectionError(error.message ?? 'Connection lost.');
                setConnectionState('disconnected');
                return;
              }
              if (!characteristic?.value) return;
              const bytes = base64ToBytes(characteristic.value);
              subscribersRef.current.forEach((cb) => cb(bytes));
            },
          );
        }

        connectedDeviceRef.current = connected;
        setActiveDevice(scanned);
        setActiveDecoder(decoder);
        setConnectionState('connected');

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
                console.warn('[ble] init command failed', e);
              }
            }
          })().catch((e) => console.warn('[ble] init sequence failed', e));
        }

        return scanned;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to connect.';
        setConnectionError(message);
        setConnectionState('failed');
        await teardownConnection();
        setActiveDevice(null);
        setActiveDecoder(null);
        return null;
      }
    },
    [ensureManager, stopScan, teardownConnection],
  );

  const subscribeData = useCallback((cb: (bytes: Uint8Array) => void) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    // Eagerly create the BleManager so its onStateChange subscription resolves
    // `availability` before the user opens the picker. Without this, the manager
    // is only created on the first scan/connect and `availability` stays at
    // 'unknown', which both blocks the auto-scan effect on the picker screen
    // and shows misleading "Scan complete" copy.
    ensureManager();
    return () => {
      stopScan();
      teardownConnection().catch(() => {});
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
  }, [ensureManager, stopScan, teardownConnection]);

  const sortedDevices = useMemo(
    () => Object.values(devices).slice().sort(compareDevices),
    [devices],
  );

  const value = useMemo<BleContextValue>(
    () => ({
      availability,
      scanning,
      devices: sortedDevices,
      scanError,
      activeDevice,
      activeDecoder,
      connectionState,
      connectionError,
      startScan,
      stopScan,
      connect,
      disconnect,
      subscribeData,
    }),
    [
      availability,
      scanning,
      sortedDevices,
      scanError,
      activeDevice,
      activeDecoder,
      connectionState,
      connectionError,
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
    throw new Error('useBle must be used within a BleProvider');
  }
  return ctx;
}
