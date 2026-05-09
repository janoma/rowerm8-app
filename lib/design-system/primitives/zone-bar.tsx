/**
 * ZoneBar — a 5-segment horizontal HR zone bar with one segment
 * highlighted as "current".
 *
 * Used as a ribbon above the live row metrics card while HR is
 * available. Segments follow the Garmin ramp from `hrZones.ts`. When
 * `current` is `null` the bar still renders (low opacity) so the
 * layout doesn't jump when zone data goes momentarily missing.
 *
 * Optional `labels` prop renders Z1-Z5 under each segment. Hidden by
 * default for the live ribbon (which only needs the colored strip).
 */

import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";
import { HR_ZONE_KEYS, type HrZoneKey } from "../tokens/hr-zones";

export type ZoneBarProps = {
  current: HrZoneKey | null;
  labels?: boolean;
  /** Bar height in dp. Defaults to 12. */
  height?: number;
  style?: ViewStyle;
};

const ZONE_LABEL: Record<HrZoneKey, string> = {
  z1: "Z1",
  z2: "Z2",
  z3: "Z3",
  z4: "Z4",
  z5: "Z5",
};

export function ZoneBar({
  current,
  labels = false,
  height = 12,
  style,
}: ZoneBarProps) {
  const { tokens } = useTheme();
  return (
    <View style={style}>
      <View
        style={[
          styles.row,
          { borderRadius: tokens.radius.sm, overflow: "hidden", height },
        ]}
      >
        {HR_ZONE_KEYS.map((key, idx) => {
          const isCurrent = current === key;
          const zone = tokens.hrZones[key];
          return (
            <View
              key={key}
              style={[
                styles.segment,
                {
                  backgroundColor: zone.bg,
                  opacity: current == null ? 0.45 : isCurrent ? 1 : 0.35,
                  marginStart: idx === 0 ? 0 : 1,
                },
              ]}
            />
          );
        })}
      </View>
      {labels ? (
        <View style={styles.labelRow}>
          {HR_ZONE_KEYS.map((key) => {
            const isCurrent = current === key;
            return (
              <Text
                key={key}
                style={[
                  styles.label,
                  {
                    color: isCurrent
                      ? tokens.hrZones[key].text
                      : tokens.colors.textTertiary,
                  },
                ]}
              >
                {ZONE_LABEL[key]}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  segment: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    marginTop: 4,
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  label: {
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
