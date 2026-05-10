/**
 * ZoneBar — a horizontal HR zone bar with one segment highlighted as
 * "current".
 *
 * Used as a ribbon above the live row metrics card while HR is
 * available. The segment count and palette are model-aware: pass the
 * 5-zone Garmin/Polar palette + keys for the standard ramp, or the
 * 7-zone Coggan/Friel palette + keys when the user opts into LTHR
 * zones. When `current` is `null` the bar still renders (low opacity)
 * so the layout doesn't jump when zone data goes momentarily missing.
 *
 * Optional `labels` prop renders short tags ("Z1", "Z5a", …) under
 * each segment. Hidden by default for the live ribbon (which only
 * needs the colored strip).
 */

import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";
import {
  COGGAN_ZONE_KEYS,
  type CogganZoneKey,
  type CogganZonePalette,
  HR_ZONE_KEYS,
  type HrZoneKey,
  type HrZonePalette,
} from "../tokens/hr-zones";

const GARMIN_LABELS: Record<HrZoneKey, string> = {
  z1: "Z1",
  z2: "Z2",
  z3: "Z3",
  z4: "Z4",
  z5: "Z5",
};

const COGGAN_LABELS: Record<CogganZoneKey, string> = {
  c1: "Z1",
  c2: "Z2",
  c3: "Z3",
  c4: "Z4",
  c5a: "Z5a",
  c5b: "Z5b",
  c5c: "Z5c",
};

type GarminProps = {
  model?: "garminPolar5";
  current: HrZoneKey | null;
  labels?: boolean;
  height?: number;
  style?: ViewStyle;
};

type CogganProps = {
  model: "cogganFriel7";
  current: CogganZoneKey | null;
  labels?: boolean;
  height?: number;
  style?: ViewStyle;
};

export type ZoneBarProps = GarminProps | CogganProps;

export function ZoneBar(props: ZoneBarProps) {
  const { tokens } = useTheme();
  const { labels = false, height = 12, style } = props;
  const isCoggan = props.model === "cogganFriel7";

  const orderedKeys: readonly (HrZoneKey | CogganZoneKey)[] = isCoggan
    ? COGGAN_ZONE_KEYS
    : HR_ZONE_KEYS;
  const palette: HrZonePalette | CogganZonePalette = isCoggan
    ? tokens.cogganZones
    : tokens.hrZones;
  const labelMap: Record<string, string> = isCoggan
    ? COGGAN_LABELS
    : GARMIN_LABELS;
  const current = props.current as HrZoneKey | CogganZoneKey | null;

  return (
    <View style={style}>
      <View
        style={[
          styles.row,
          { borderRadius: tokens.radius.sm, overflow: "hidden", height },
        ]}
      >
        {orderedKeys.map((key, idx) => {
          const isCurrent = current === key;
          // The narrowed palette/key types below are safe — `palette`
          // is keyed on the same union as `orderedKeys`.
          const zone = (palette as Record<string, { bg: string }>)[key];
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
          {orderedKeys.map((key) => {
            const isCurrent = current === key;
            const zone = (palette as Record<string, { text: string }>)[key];
            return (
              <Text
                key={key}
                style={[
                  styles.label,
                  {
                    color: isCurrent ? zone.text : tokens.colors.textTertiary,
                  },
                ]}
              >
                {labelMap[key]}
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
