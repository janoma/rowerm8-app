import type { DecodedFrame, SensorDecoder } from "./types";

// Standard BLE Heart Rate Service (0x180D) and Heart Rate Measurement
// characteristic (0x2A37). Defined in the Bluetooth SIG Heart Rate Profile;
// implemented by Polar H9/H10, Wahoo Tickr, Garmin HRM-Dual/Pro, Coros, etc.
const HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb";

function isHeartRateService(uuid: string): boolean {
  // BLE service UUIDs may come as the 16-bit short form ("180D") or as the
  // expanded 128-bit form. Compare case-insensitively against both.
  const lower = uuid.toLowerCase();
  return lower === "180d" || lower === HR_SERVICE_UUID;
}

/**
 * Decoder for the standard BLE Heart Rate Measurement characteristic.
 *
 * Wire format (ref: Bluetooth SIG Heart Rate Profile / GATT 0x2A37):
 *   byte 0:    flags
 *     bit 0:   HR value format (0 = uint8, 1 = uint16)
 *     bits 1-2: sensor contact bits (ignored here)
 *     bit 3:   energy expended present (uint16 follows HR)
 *     bit 4:   RR intervals present (1+ uint16 follow, in 1/1024 s units)
 *   byte 1...: HR value (uint8 or uint16 LE per bit 0)
 *   ...:       optional energy expended (uint16 LE), optional RR intervals
 *
 * Most HRMs notify at ~1 Hz with the simple uint8 form, no energy, no RR.
 *
 * Battery isn't part of this characteristic — HRMs expose it on the standard
 * Battery Service (0x180F / 0x2A19). Wiring that up is a follow-up; for now
 * we leave `batteryPercent` unset in the slot and the indicator hides itself.
 */
export const heartRateStandard: SensorDecoder = {
  key: "ble-heart-rate-standard",
  role: "hr",
  displayName: "Heart-rate monitor",
  vendorDescription: "Standard BLE Heart Rate Service",
  recommended: true,
  serviceUuid: HR_SERVICE_UUID,
  notifyUuid: HR_MEASUREMENT_UUID,
  matches: ({ serviceUUIDs }) => {
    // Devices returned by an HR-filtered scan often arrive without their
    // serviceUUIDs populated on iOS, so a strict "must include 180D" check
    // would discard them. Accept the device whenever the UUIDs include the
    // HR service OR when no UUIDs were advertised — the platform-level
    // service filter on the scan side keeps us honest.
    if (!serviceUUIDs || serviceUUIDs.length === 0) {
      return true;
    }
    return serviceUUIDs.some(isHeartRateService);
  },
  decode: (bytes) => {
    if (bytes.length < 2) {
      return [];
    }
    const flags = bytes[0];
    const is16Bit = (flags & 0x01) !== 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);

    let offset = 1;
    let bpm: number;
    if (is16Bit) {
      if (bytes.length < 3) {
        return [];
      }
      bpm = view.getUint16(offset, true);
      offset += 2;
    } else {
      bpm = view.getUint8(offset);
      offset += 1;
    }

    const hasEnergy = (flags & 0x08) !== 0;
    if (hasEnergy) {
      offset += 2;
    }

    const hasRr = (flags & 0x10) !== 0;
    let rrIntervalsMs: number[] | undefined;
    if (hasRr) {
      const intervals: number[] = [];
      while (offset + 2 <= bytes.length) {
        const raw = view.getUint16(offset, true);
        // RR is reported in 1/1024 second units per the spec.
        intervals.push((raw * 1000) / 1024);
        offset += 2;
      }
      rrIntervalsMs = intervals;
    }

    const frame: DecodedFrame = { heartRateBpm: bpm };
    if (rrIntervalsMs && rrIntervalsMs.length) {
      frame.rrIntervalsMs = rrIntervalsMs;
    }
    return [frame];
  },
};
