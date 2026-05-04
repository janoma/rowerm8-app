import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Fonts } from '@/constants/theme';
import type { AccelerometerSample } from '@/hooks/use-accelerometer-stream';

const COLORS = {
  light: {
    surface: '#F2F3F5',
    surfaceBorder: '#E4E6EA',
    label: '#687076',
    axisLabel: '#9BA1A6',
    value: '#11181C',
    accent: '#0a7ea4',
    pulse: '#1F9D55',
    sparkBg: '#E9EBEE',
  },
  dark: {
    surface: '#1F2224',
    surfaceBorder: '#2A2D30',
    label: '#9BA1A6',
    axisLabel: '#7C8186',
    value: '#ECEDEE',
    accent: '#3DB7E0',
    pulse: '#34C759',
    sparkBg: '#15171A',
  },
} as const;

const monoFont = Platform.select({
  ios: Fonts.mono,
  android: Fonts.mono,
  default: Fonts.mono,
}) as string;

type Props = {
  sample: AccelerometerSample | null;
  history: number[];
  sampleRateHz: number;
};

export function LiveAccelerationCard({ sample, history, sampleRateHz }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = COLORS[scheme];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.surfaceBorder },
      ]}>
      <View style={styles.headerRow}>
        <ThemedText style={[styles.headerLabel, { color: palette.label }]}>
          LIVE ACCELERATION (m/s²)
        </ThemedText>
        <View style={[styles.pulseDot, { backgroundColor: palette.pulse }]} />
      </View>

      <View style={styles.axesRow}>
        <AxisReadout
          axis="X"
          value={sample?.x}
          axisColor={palette.axisLabel}
          valueColor={palette.value}
        />
        <AxisReadout
          axis="Y"
          value={sample?.y}
          axisColor={palette.axisLabel}
          valueColor={palette.value}
        />
        <AxisReadout
          axis="Z"
          value={sample?.z}
          axisColor={palette.axisLabel}
          valueColor={palette.value}
        />
      </View>

      <Sparkline data={history} accent={palette.accent} background={palette.sparkBg} />

      <ThemedText style={[styles.footer, { color: palette.label }]}>
        Sampling at {sampleRateHz} Hz
      </ThemedText>
    </View>
  );
}

function AxisReadout({
  axis,
  value,
  axisColor,
  valueColor,
}: {
  axis: string;
  value: number | undefined;
  axisColor: string;
  valueColor: string;
}) {
  const display = value === undefined || Number.isNaN(value) ? '—' : value.toFixed(2);
  return (
    <View style={styles.axisCol}>
      <ThemedText style={[styles.axisLabel, { color: axisColor }]}>{axis}</ThemedText>
      <ThemedText
        style={[styles.axisValue, { color: valueColor, fontFamily: monoFont }]}
        numberOfLines={1}>
        {display}
      </ThemedText>
    </View>
  );
}

function Sparkline({
  data,
  accent,
  background,
}: {
  data: number[];
  accent: string;
  background: string;
}) {
  const max = Math.max(0.5, ...data.map((v) => Math.abs(v)));
  return (
    <View style={[styles.sparkContainer, { backgroundColor: background }]}>
      {data.map((value, index) => {
        const normalized = Math.min(1, Math.abs(value) / max);
        const heightPct = 6 + normalized * 88;
        return (
          <View
            key={index}
            style={[
              styles.sparkBar,
              {
                backgroundColor: accent,
                height: `${heightPct}%`,
                opacity: 0.55 + normalized * 0.45,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    flex: 1,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  axesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  axisCol: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  axisLabel: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 14,
  },
  axisValue: {
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
  },
  sparkContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 1.5,
    minHeight: 2,
  },
  footer: {
    fontSize: 12,
    lineHeight: 14,
  },
});
