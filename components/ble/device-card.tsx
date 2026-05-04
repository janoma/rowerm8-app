import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ScannedDevice } from '@/contexts/ble-context';

const COLORS = {
  light: {
    surface: '#F2F3F5',
    surfaceBorder: '#E4E6EA',
    surfaceRecommended: '#F2F3F5',
    recommendedBorder: '#0a7ea4',
    iconActive: '#0a7ea4',
    iconActiveBg: 'rgba(10, 126, 164, 0.18)',
    iconInactive: '#687076',
    iconInactiveBg: '#E4E6EA',
    title: '#11181C',
    subtitle: '#687076',
    chevron: '#9BA1A6',
    pillBg: 'rgba(31, 157, 85, 0.18)',
    pillText: '#117A3D',
    rssi: '#687076',
  },
  dark: {
    surface: '#1F2224',
    surfaceBorder: '#2A2D30',
    surfaceRecommended: '#1F2224',
    recommendedBorder: '#3DB7E0',
    iconActive: '#3DB7E0',
    iconActiveBg: 'rgba(61, 183, 224, 0.22)',
    iconInactive: '#9BA1A6',
    iconInactiveBg: '#2A2D30',
    title: '#ECEDEE',
    subtitle: '#9BA1A6',
    chevron: '#7C8186',
    pillBg: 'rgba(52, 199, 89, 0.18)',
    pillText: '#34C759',
    rssi: '#9BA1A6',
  },
} as const;

type Props = {
  device: ScannedDevice;
  busy?: boolean;
  onPress: (device: ScannedDevice) => void;
};

export function DeviceCard({ device, busy = false, onPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = COLORS[scheme];

  const recommended = !!device.decoder?.recommended;
  const displayName = device.name ?? device.localName ?? `Unknown ${device.id.slice(-5)}`;
  const subtitle = device.decoder?.vendorDescription ?? 'No decoder available';

  return (
    <Pressable
      onPress={() => onPress(device)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Connect to ${displayName}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: recommended ? palette.surfaceRecommended : palette.surface,
          borderColor: palette.surfaceBorder,
          opacity: busy ? 0.5 : pressed ? 0.85 : 1,
        },
        recommended && {
          borderLeftColor: palette.recommendedBorder,
          borderLeftWidth: 3,
        },
      ]}>
      <View
        style={[
          styles.iconBadge,
          {
            backgroundColor: recommended ? palette.iconActiveBg : palette.iconInactiveBg,
          },
        ]}>
        <IconSymbol
          name="dot.radiowaves.right"
          size={22}
          color={recommended ? palette.iconActive : palette.iconInactive}
        />
      </View>

      <View style={styles.textBlock}>
        <ThemedText style={[styles.title, { color: palette.title }]} numberOfLines={1}>
          {displayName}
        </ThemedText>
        <View style={styles.subtitleRow}>
          {recommended ? (
            <View style={[styles.pill, { backgroundColor: palette.pillBg }]}>
              <ThemedText style={[styles.pillText, { color: palette.pillText }]}>
                Recommended
              </ThemedText>
            </View>
          ) : null}
          <ThemedText style={[styles.subtitle, { color: palette.subtitle }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>
        {device.rssi != null ? (
          <ThemedText style={[styles.rssi, { color: palette.rssi }]}>
            Signal: {device.rssi} dBm
          </ThemedText>
        ) : null}
      </View>

      <IconSymbol name="chevron.right" size={18} color={palette.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 16,
    flexShrink: 1,
  },
  rssi: {
    fontSize: 12,
    lineHeight: 14,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
});
