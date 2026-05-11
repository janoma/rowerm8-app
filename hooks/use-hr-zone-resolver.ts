/**
 * Unified live HR-zone resolver.
 *
 * Reads `useProfile().resolved.hrZoneModel` and returns the
 * (palette, key, classifier) triple that matches:
 *
 *   - `garminPolar5`: 5-zone Garmin/Polar ramp keyed by % of max HR.
 *   - `cogganFriel7`: 7-zone Coggan/Friel ramp keyed by % of LTHR.
 *
 * Call sites pass the returned triple to the design-system primitives
 * (`<ZoneBar>`, `<ZonePill>`) plus call `.resolve(bpm)` to map a live
 * reading into the active model's zone key. The classifier returns
 * `null` for null / non-finite bpm so consumers can render
 * missing-data states without an extra check.
 *
 * The Coggan/Friel branch is gated behind
 * {@link ENABLE_COGGAN_HR_ZONE_MODEL}; while the flag is `false` the
 * hook always returns the 5-zone variant regardless of any persisted
 * `hrZoneModel` value, so an existing `cogganFriel7` selection on
 * disk is harmless and is restored automatically when the flag flips
 * back on.
 *
 * Pure: the underlying classifiers are pure ({@link zoneForBpm} /
 * {@link cogganZoneForBpm}); this hook only adds the profile lookup
 * and a stable-identity wrapper.
 */
import { useMemo } from "react";

import { useProfile } from "@/contexts/profile-context";
import {
  type CogganZoneKey,
  type CogganZonePalette,
  type HrZoneKey,
  type HrZonePalette,
  useTheme,
} from "@/lib/design-system";
import { ENABLE_COGGAN_HR_ZONE_MODEL } from "@/lib/feature-flags";
import {
  type CogganZoneRanges,
  cogganZoneForBpm,
  cogganZoneRanges,
  defaultZoneRanges,
  type ZoneRanges,
  zoneForBpm,
} from "@/lib/hr/zones";

export type HrZoneResolver =
  | {
      kind: "garminPolar5";
      ranges: ZoneRanges;
      palette: HrZonePalette;
      orderedKeys: readonly HrZoneKey[];
      resolve: (bpm: number | null | undefined) => HrZoneKey | null;
    }
  | {
      kind: "cogganFriel7";
      ranges: CogganZoneRanges;
      palette: CogganZonePalette;
      orderedKeys: readonly CogganZoneKey[];
      resolve: (bpm: number | null | undefined) => CogganZoneKey | null;
    };

const GARMIN_POLAR_KEYS: readonly HrZoneKey[] = ["z1", "z2", "z3", "z4", "z5"];
const COGGAN_FRIEL_KEYS: readonly CogganZoneKey[] = [
  "c1",
  "c2",
  "c3",
  "c4",
  "c5a",
  "c5b",
  "c5c",
];

export function useHrZoneResolver(): HrZoneResolver {
  const { resolved: profile } = useProfile();
  const { tokens } = useTheme();
  const { hrZoneModel, maxHrBpm, thresholdHrBpm } = profile;

  return useMemo<HrZoneResolver>(() => {
    if (ENABLE_COGGAN_HR_ZONE_MODEL && hrZoneModel === "cogganFriel7") {
      const ranges = cogganZoneRanges(thresholdHrBpm);
      return {
        kind: "cogganFriel7",
        ranges,
        palette: tokens.cogganZones,
        orderedKeys: COGGAN_FRIEL_KEYS,
        resolve: (bpm) => cogganZoneForBpm(bpm, ranges),
      };
    }
    const ranges = defaultZoneRanges(maxHrBpm);
    return {
      kind: "garminPolar5",
      ranges,
      palette: tokens.hrZones,
      orderedKeys: GARMIN_POLAR_KEYS,
      resolve: (bpm) => zoneForBpm(bpm, ranges),
    };
  }, [
    hrZoneModel,
    maxHrBpm,
    thresholdHrBpm,
    tokens.cogganZones,
    tokens.hrZones,
  ]);
}
