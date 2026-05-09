/**
 * ZonePill — a single-zone label pill.
 *
 * Used inline next to a HR value (e.g. "162 BPM [Z4]"). The pill is
 * tinted with the zone's `bgSubtle` and the label is the zone's
 * `text` (legible against `surface`); these are picked so the pill
 * reads as a quick zone tag without competing visually with the
 * primary numeral.
 */

import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";
import type { HrZoneKey } from "../tokens/hr-zones";

const ZONE_LABEL: Record<HrZoneKey, string> = {
  z1: "Z1",
  z2: "Z2",
  z3: "Z3",
  z4: "Z4",
  z5: "Z5",
};

export type ZonePillProps = {
  zone: HrZoneKey;
  /** When true, fills with the zone's saturated bg (more emphatic). */
  filled?: boolean;
  style?: ViewStyle;
};

export function ZonePill({ zone, filled = false, style }: ZonePillProps) {
  const { tokens } = useTheme();
  const t = tokens.hrZones[zone];
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
        {ZONE_LABEL[zone]}
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
