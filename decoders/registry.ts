import { heartRateStandard } from "./heart-rate-standard";
import type { DecoderDeviceHint, DecoderRole, SensorDecoder } from "./types";
import { witmotionBwt901 } from "./witmotion-bwt901";

export const KNOWN_DECODERS: SensorDecoder[] = [
  witmotionBwt901,
  heartRateStandard,
];

const BY_KEY: Record<string, SensorDecoder> = Object.fromEntries(
  KNOWN_DECODERS.map((d) => [d.key, d]),
);

/**
 * Find the first decoder for {@link role} that claims this device. Roles are
 * mutually exclusive, so a motion scan never resolves to an HR decoder and
 * vice versa, even if both happened to match the device hint.
 */
export function findDecoder(
  device: DecoderDeviceHint,
  role: DecoderRole,
): SensorDecoder | null {
  return (
    KNOWN_DECODERS.find((d) => d.role === role && d.matches(device)) ?? null
  );
}

export function getDecoderByKey(
  key: string | null | undefined,
): SensorDecoder | null {
  if (!key) {
    return null;
  }
  return BY_KEY[key] ?? null;
}
