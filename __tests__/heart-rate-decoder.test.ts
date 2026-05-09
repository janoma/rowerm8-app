import { heartRateStandard } from "@/decoders/heart-rate-standard";

function frameWithBpm(bpm: number, flags: number = 0x00): Uint8Array {
  const is16Bit = (flags & 0x01) !== 0;
  const buf = new Uint8Array(is16Bit ? 3 : 2);
  buf[0] = flags;
  if (is16Bit) {
    buf[1] = bpm & 0xff;
    buf[2] = (bpm >> 8) & 0xff;
  } else {
    buf[1] = bpm;
  }
  return buf;
}

describe("heart-rate-standard decoder", () => {
  it("decodes a uint8 BPM value when flags bit 0 is clear", () => {
    const frames = heartRateStandard.decode(frameWithBpm(72));
    expect(frames).toHaveLength(1);
    expect(frames[0].heartRateBpm).toBe(72);
    expect(frames[0].rrIntervalsMs).toBeUndefined();
  });

  it("decodes a uint16 BPM value when flags bit 0 is set", () => {
    const frames = heartRateStandard.decode(frameWithBpm(300, 0x01));
    expect(frames).toHaveLength(1);
    expect(frames[0].heartRateBpm).toBe(300);
  });

  it("ignores the energy-expended field but still parses BPM after it", () => {
    // flags: bit 0 = 0 (uint8 BPM), bit 3 = 1 (energy present), bit 4 = 0 (no RR)
    const flags = 0x08;
    const bytes = new Uint8Array([flags, 80, 0xc8, 0x00]);
    const frames = heartRateStandard.decode(bytes);
    expect(frames[0].heartRateBpm).toBe(80);
    expect(frames[0].rrIntervalsMs).toBeUndefined();
  });

  it("decodes RR intervals when flags bit 4 is set", () => {
    // flags: bit 4 = 1 (RR present), uint8 BPM. RR raw 1024 -> 1000 ms.
    const flags = 0x10;
    const rrRaw = 1024;
    const bytes = new Uint8Array([
      flags,
      55,
      rrRaw & 0xff,
      (rrRaw >> 8) & 0xff,
    ]);
    const frames = heartRateStandard.decode(bytes);
    expect(frames[0].heartRateBpm).toBe(55);
    expect(frames[0].rrIntervalsMs).toEqual([1000]);
  });

  it("decodes multiple RR intervals in a single frame", () => {
    const flags = 0x10;
    const bytes = new Uint8Array([
      flags,
      60,
      0x00,
      0x04, // 1024 -> 1000 ms
      0x00,
      0x02, // 512 -> 500 ms
    ]);
    const frames = heartRateStandard.decode(bytes);
    expect(frames[0].rrIntervalsMs).toEqual([1000, 500]);
  });

  it("returns an empty array for too-short payloads", () => {
    expect(heartRateStandard.decode(new Uint8Array([]))).toEqual([]);
    expect(heartRateStandard.decode(new Uint8Array([0x00]))).toEqual([]);
    // flags say uint16 but only 2 bytes provided
    expect(heartRateStandard.decode(new Uint8Array([0x01, 0x00]))).toEqual([]);
  });

  it("matches a device that advertises the 0x180D service", () => {
    expect(
      heartRateStandard.matches({
        name: "Polar H10",
        localName: null,
        serviceUUIDs: ["0000180d-0000-1000-8000-00805f9b34fb"],
      }),
    ).toBe(true);
    expect(
      heartRateStandard.matches({
        name: "Polar H10",
        localName: null,
        serviceUUIDs: ["180D"],
      }),
    ).toBe(true);
  });

  it("trusts the platform scan filter when serviceUUIDs is unavailable", () => {
    expect(
      heartRateStandard.matches({
        name: "Wahoo Tickr",
        localName: null,
        serviceUUIDs: null,
      }),
    ).toBe(true);
  });

  it("rejects a device that advertises only unrelated services", () => {
    expect(
      heartRateStandard.matches({
        name: "WT9011",
        localName: null,
        serviceUUIDs: ["0000ffe5-0000-1000-8000-00805f9a34fb"],
      }),
    ).toBe(false);
  });
});
