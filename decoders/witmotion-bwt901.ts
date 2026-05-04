import type { SensorDecoder } from './types';

const G = 9.80665;
const ACCEL_RANGE_G = 16;
const ACCEL_SCALE = (ACCEL_RANGE_G * G) / 32768;
const GYRO_RANGE_DPS = 2000;
const GYRO_SCALE = GYRO_RANGE_DPS / 32768;
const ANGLE_RANGE_DEG = 180;
const ANGLE_SCALE = ANGLE_RANGE_DEG / 32768;

const WIT_NAME_PREFIXES = ['WT', 'BWT', 'HWT'];

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
  key: 'witmotion-bwt901',
  displayName: 'WitMotion 9-axis IMU',
  vendorDescription: 'WT9011DCL / BWT901BLE5.0',
  recommended: true,
  serviceUuid: '0000ffe5-0000-1000-8000-00805f9a34fb',
  notifyUuid: '0000ffe4-0000-1000-8000-00805f9a34fb',
  writeUuid: '0000ffe9-0000-1000-8000-00805f9a34fb',
  matches: ({ name, localName }) => {
    const candidate = (name ?? localName ?? '').toUpperCase();
    return WIT_NAME_PREFIXES.some((prefix) => candidate.startsWith(prefix));
  },
  decode: (bytes) => {
    if (bytes.length < 20) return null;
    if (bytes[0] !== 0x55 || bytes[1] !== 0x61) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ax = view.getInt16(2, true) * ACCEL_SCALE;
    const ay = view.getInt16(4, true) * ACCEL_SCALE;
    const az = view.getInt16(6, true) * ACCEL_SCALE;
    const wx = view.getInt16(8, true) * GYRO_SCALE;
    const wy = view.getInt16(10, true) * GYRO_SCALE;
    const wz = view.getInt16(12, true) * GYRO_SCALE;
    const roll = view.getInt16(14, true) * ANGLE_SCALE;
    const pitch = view.getInt16(16, true) * ANGLE_SCALE;
    const yaw = view.getInt16(18, true) * ANGLE_SCALE;

    return {
      accel: {
        x: ax,
        y: ay,
        z: az,
        magnitude: Math.sqrt(ax * ax + ay * ay + az * az),
      },
      angularVelocity: { x: wx, y: wy, z: wz },
      angle: { roll, pitch, yaw },
    };
  },
};
