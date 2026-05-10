/**
 * ZonePill — a single-zone label pill.
 *
 * Used inline next to a HR value (e.g. "162 BPM [Z4]" or "172 BPM
 * [Z5a]"). The pill is tinted with the zone's `bgSubtle` and the
 * label is the zone's `text` (legible against `surface`); these are
 * picked so the pill reads as a quick zone tag without competing
 * visually with the primary numeral.
 *
 * Accepts either of the two HR-zone models (5-zone Garmin/Polar or
 * 7-zone Coggan/Friel). The model is inferred from the `zone` prop's
 * key shape; the corresponding palette is read from the active theme
 * (`tokens.hrZones` vs `tokens.cogganZones`).
 */

import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";
import type { CogganZoneKey, HrZoneKey } from "../tokens/hr-zones";

const GARMIN_LABEL: Record<HrZoneKey, string> = {
  z1: "Z1",
  z2: "Z2",
  z3: "Z3",
  z4: "Z4",
  z5: "Z5",
};

const COGGAN_LABEL: Record<CogganZoneKey, string> = {
  c1: "Z1",
  c2: "Z2",
  c3: "Z3",
  c4: "Z4",
  c5a: "Z5a",
  c5b: "Z5b",
  c5c: "Z5c",
};

export type ZonePillProps = {
  zone: HrZoneKey | CogganZoneKey;
  /** When true, fills with the zone's saturated bg (more emphatic). */
  filled?: boolean;
  style?: ViewStyle;
};

function isCogganKey(zone: HrZoneKey | CogganZoneKey): zone is CogganZoneKey {
  return zone.startsWith("c");
}

export function ZonePill({ zone, filled = false, style }: ZonePillProps) {
  const { tokens } = useTheme();
  const t = isCogganKey(zone) ? tokens.cogganZones[zone] : tokens.hrZones[zone];
  const label = isCogganKey(zone) ? COGGAN_LABEL[zone] : GARMIN_LABEL[zone];
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: filled ? t.bg : t.bgSubtle,
          borderRadius: tokens.radius.sm,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: filled ? t.onZoneText : t.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
