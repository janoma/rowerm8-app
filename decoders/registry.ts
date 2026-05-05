import type { DecoderDeviceHint, SensorDecoder } from "./types";
import { witmotionBwt901 } from "./witmotion-bwt901";

export const KNOWN_DECODERS: SensorDecoder[] = [witmotionBwt901];

const BY_KEY: Record<string, SensorDecoder> = Object.fromEntries(
  KNOWN_DECODERS.map((d) => [d.key, d]),
);

export function findDecoder(device: DecoderDeviceHint): SensorDecoder | null {
  return KNOWN_DECODERS.find((d) => d.matches(device)) ?? null;
}

export function getDecoderByKey(
  key: string | null | undefined,
): SensorDecoder | null {
  if (!key) return null;
  return BY_KEY[key] ?? null;
}
