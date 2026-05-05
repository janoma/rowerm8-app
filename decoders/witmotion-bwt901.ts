import type { DecodedFrame, SensorDecoder } from "./types";

const G = 9.80665;
const ACCEL_RANGE_G = 16;
const ACCEL_SCALE = (ACCEL_RANGE_G * G) / 32768;
const GYRO_RANGE_DPS = 2000;
const GYRO_SCALE = GYRO_RANGE_DPS / 32768;
const ANGLE_RANGE_DEG = 180;
const ANGLE_SCALE = ANGLE_RANGE_DEG / 32768;

const WIT_NAME_PREFIXES = ["WT", "BWT", "HWT"];

// Output Rate Register (RRATE = 0x03) value codes from the WitMotion protocol:
//   0x06 = 10 Hz (factory default), 0x07 = 20 Hz, 0x08 = 50 Hz, 0x09 = 100 Hz, 0x0B = 200 Hz.
// We pick 0x08 (50 Hz) — the highest discrete WitMotion rate at or below our 60 Hz cap.
// Writes to config registers must be preceded by the magic unlock command.
const WIT_UNLOCK = new Uint8Array([0xff, 0xaa, 0x69, 0x88, 0xb5]);
const WIT_SET_RATE_50HZ = new Uint8Array([0xff, 0xaa, 0x03, 0x08, 0x00]);

/**
 * WitMotion BWT901BLE5.0-family decoder, used by the WT9011DCL among others.
 *
 * Active output frame (20 bytes):
 *   byte 0:    0x55  (header)
 *   byte 1:    0x61  (active acc + gyro + angle frame)
 *   bytes 2-7:  ax, ay, az   (3x int16 LE)
 *   bytes 8-13: wx, wy, wz   (3x int16 LE, deg/s)
 *   bytes 14-19: roll, pitch, yaw (3x int16 LE, deg)
 *
 * Confirmed against
 * https://github.com/WITMOTION/WitBluetooth_BWT901BLE5_0 (BleUUID + Bwt901bleResolver).
 */
export const witmotionBwt901: SensorDecoder = {
  key: "witmotion-bwt901",
  displayName: "WitMotion 9-axis IMU",
  vendorDescription: "WT9011DCL / BWT901BLE5.0",
  recommended: true,
  serviceUuid: "0000ffe5-0000-1000-8000-00805f9a34fb",
  notifyUuid: "0000ffe4-0000-1000-8000-00805f9a34fb",
  writeUuid: "0000ffe9-0000-1000-8000-00805f9a34fb",
  initCommands: [WIT_UNLOCK, WIT_SET_RATE_50HZ],
  matches: ({ name, localName }) => {
    const candidate = (name ?? localName ?? "").toUpperCase();
    return WIT_NAME_PREFIXES.some((prefix) => candidate.startsWith(prefix));
  },
  decode: (bytes) => {
    const frames: DecodedFrame[] = [];
    let i = 0;
    while (i + 20 <= bytes.length) {
      if (bytes[i] !== 0x55 || bytes[i + 1] !== 0x61) {
        // Resync: skip a single byte and try the next position. Junk between
        // back-to-back frames is rare but worth tolerating.
        i += 1;
        continue;
      }

      const view = new DataView(bytes.buffer, bytes.byteOffset + i, 20);
      const ax = view.getInt16(2, true) * ACCEL_SCALE;
      const ay = view.getInt16(4, true) * ACCEL_SCALE;
      const az = view.getInt16(6, true) * ACCEL_SCALE;
      const wx = view.getInt16(8, true) * GYRO_SCALE;
      const wy = view.getInt16(10, true) * GYRO_SCALE;
      const wz = view.getInt16(12, true) * GYRO_SCALE;
      const roll = view.getInt16(14, true) * ANGLE_SCALE;
      const pitch = view.getInt16(16, true) * ANGLE_SCALE;
      const yaw = view.getInt16(18, true) * ANGLE_SCALE;

      frames.push({
        accel: {
          x: ax,
          y: ay,
          z: az,
          magnitude: Math.sqrt(ax * ax + ay * ay + az * az),
        },
        angularVelocity: { x: wx, y: wy, z: wz },
        angle: { roll, pitch, yaw },
      });

      i += 20;
    }
    return frames;
  },
};
