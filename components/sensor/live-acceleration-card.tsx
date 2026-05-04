import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import type { AccelerometerSample, AxisHistories } from '@/hooks/use-accelerometer-stream';
import { useColorScheme } from '@/hooks/use-color-scheme';

const COLORS = {
  light: {
    surface: '#F2F3F5',
    surfaceBorder: '#E4E6EA',
    label: '#687076',
    axisLabel: '#687076',
    value: '#11181C',
    pulse: '#1F9D55',
    sparkBg: '#E9EBEE',
    sparkAxis: '#C7C9CC',
    axisX: '#E5484D',
    axisY: '#1F9D55',
    axisZ: '#0a7ea4',
  },
  dark: {
    surface: '#1F2224',
    surfaceBorder: '#2A2D30',
    label: '#9BA1A6',
    axisLabel: '#9BA1A6',
    value: '#ECEDEE',
    pulse: '#34C759',
    sparkBg: '#15171A',
    sparkAxis: '#2F3236',
    axisX: '#FF6369',
    axisY: '#34C759',
    axisZ: '#3DB7E0',
  },
} as const;

const monoFont = Fonts.mono;

type AxisKey = 'x' | 'y' | 'z';

const AXES: { key: AxisKey; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'z', label: 'Z' },
];

type Props = {
  sample: AccelerometerSample | null;
  histories: AxisHistories;
  sampleRateHz: number;
};

export function LiveAccelerationCard({ sample, histories, sampleRateHz }: Props) {
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

      <View style={styles.axisStack}>
        {AXES.map(({ key, label }) => (
          <AxisRow
            key={key}
            label={label}
            value={sample?.[key]}
            data={histories[key]}
            accent={
              key === 'x' ? palette.axisX : key === 'y' ? palette.axisY : palette.axisZ
            }
            axisLabelColor={palette.axisLabel}
            valueColor={palette.value}
            sparkBg={palette.sparkBg}
            sparkAxisColor={palette.sparkAxis}
          />
        ))}
      </View>

      <ThemedText style={[styles.footer, { color: palette.label }]}>
        Sampling at {sampleRateHz} Hz
      </ThemedText>
    </View>
  );
}

function AxisRow({
  label,
  value,
  data,
  accent,
  axisLabelColor,
  valueColor,
  sparkBg,
  sparkAxisColor,
}: {
  label: string;
  value: number | undefined;
  data: number[];
  accent: string;
  axisLabelColor: string;
  valueColor: string;
  sparkBg: string;
  sparkAxisColor: string;
}) {
  const display = value === undefined || Number.isNaN(value) ? '   —  ' : formatValue(value);
  return (
    <View style={styles.axisRow}>
      <ThemedText style={[styles.axisLabel, { color: axisLabelColor }]}>{label}</ThemedText>
      <ThemedText
        style={[styles.axisValue, { color: valueColor, fontFamily: monoFont }]}
        numberOfLines={1}>
        {display}
      </ThemedText>
      <Sparkline data={data} accent={accent} background={sparkBg} axisColor={sparkAxisColor} />
    </View>
  );
}

function Sparkline({
  data,
  accent,
  background,
  axisColor,
}: {
  data: number[];
  accent: string;
  background: string;
  axisColor: string;
}) {
  const max = Math.max(0.5, ...data.map((v) => Math.abs(v)));
  return (
    <View style={[styles.sparkContainer, { backgroundColor: background }]}>
      <View style={[styles.sparkAxis, { backgroundColor: axisColor }]} />
      {data.map((value, index) => {
        const normalized = Math.min(1, Math.abs(value) / max);
        const heightPct = normalized * 50;
        const isPositive = value >= 0;
        return (
          <View key={index} style={styles.sparkSlot}>
            <View
              style={[
                styles.sparkBar,
                {
                  backgroundColor: accent,
                  height: `${heightPct}%`,
                  opacity: 0.55 + normalized * 0.45,
                  ...(isPositive ? { bottom: '50%' } : { top: '50%' }),
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function formatValue(value: number) {
  const fixed = value.toFixed(2);
  return value >= 0 ? ` ${fixed}` : fixed;
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
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
  axisStack: {
    gap: 8,
  },
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  axisLabel: {
    fontSize: 12,
    fontWeight: '700',
    width: 14,
  },
  axisValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 56,
    textAlign: 'right',
  },
  sparkContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 30,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  sparkAxis: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: '50%',
    height: StyleSheet.hairlineWidth,
  },
  sparkSlot: {
    flex: 1,
    height: '100%',
    position: 'relative',
    marginHorizontal: 0.5,
  },
  sparkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 1,
    minHeight: 1,
  },
  footer: {
    fontSize: 12,
    lineHeight: 14,
  },
});
