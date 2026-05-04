import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

const COLORS = {
  light: {
    backdrop: 'rgba(0, 0, 0, 0.35)',
    sheet: '#FFFFFF',
    grabber: '#C7C9CC',
    cardEnabled: '#F2F3F5',
    cardEnabledBorder: '#E4E6EA',
    cardDisabled: '#F7F8F9',
    cardDisabledBorder: '#ECEDEE',
    title: '#11181C',
    subtitle: '#687076',
    accent: '#0a7ea4',
    accentSoft: 'rgba(10, 126, 164, 0.18)',
    chevron: '#687076',
    bluetoothBadgeIcon: '#9BA1A6',
    bluetoothBadgeBg: '#E4E6EA',
    pillBg: 'rgba(224, 138, 30, 0.18)',
    pillText: '#B26A0F',
  },
  dark: {
    backdrop: 'rgba(0, 0, 0, 0.55)',
    sheet: '#1B1D1F',
    grabber: '#3A3D40',
    cardEnabled: '#26292C',
    cardEnabledBorder: '#2F3236',
    cardDisabled: '#1F2224',
    cardDisabledBorder: '#26292C',
    title: '#ECEDEE',
    subtitle: '#9BA1A6',
    accent: '#3DB7E0',
    accentSoft: 'rgba(61, 183, 224, 0.22)',
    chevron: '#9BA1A6',
    bluetoothBadgeIcon: '#6E7174',
    bluetoothBadgeBg: '#2F3236',
    pillBg: 'rgba(255, 176, 32, 0.18)',
    pillText: '#FFB020',
  },
} as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectPhone: () => void;
};

export function SensorPickerSheet({ visible, onClose, onSelectPhone }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = COLORS[scheme];

  const handleBluetoothPress = () => {
    Alert.alert(
      'Bluetooth sensors not available yet',
      'External Bluetooth IMUs require a custom development build with native BLE support. This will be enabled in a later iteration.',
      [{ text: 'OK', style: 'default' }],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.backdrop }]} onPress={onClose} />
      <View style={styles.sheetWrapper} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: palette.sheet }]}>
          <View style={[styles.grabber, { backgroundColor: palette.grabber }]} />
          <ThemedText style={[styles.title, { color: palette.title }]}>Choose motion sensor</ThemedText>

          <Pressable
            onPress={() => {
              onSelectPhone();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Use phone accelerometer"
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: palette.cardEnabled,
                borderColor: palette.cardEnabledBorder,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <View style={[styles.optionIcon, { backgroundColor: palette.accentSoft }]}>
              <IconSymbol name="iphone" size={24} color={palette.accent} />
            </View>
            <View style={styles.optionTextBlock}>
              <ThemedText style={[styles.optionTitle, { color: palette.title }]}>Use phone</ThemedText>
              <ThemedText style={[styles.optionSubtitle, { color: palette.subtitle }]}>
                Use this device&apos;s built-in accelerometer
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={palette.chevron} />
          </Pressable>

          <Pressable
            onPress={handleBluetoothPress}
            accessibilityRole="button"
            accessibilityLabel="Select Bluetooth device, currently unavailable"
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: palette.cardDisabled,
                borderColor: palette.cardDisabledBorder,
                opacity: pressed ? 0.85 : 0.6,
              },
            ]}>
            <View style={[styles.optionIcon, { backgroundColor: palette.bluetoothBadgeBg }]}>
              <IconSymbol name="dot.radiowaves.right" size={24} color={palette.bluetoothBadgeIcon} />
            </View>
            <View style={styles.optionTextBlock}>
              <ThemedText style={[styles.optionTitle, { color: palette.title }]}>
                Select Bluetooth device
              </ThemedText>
              <ThemedText style={[styles.optionSubtitle, { color: palette.subtitle }]}>
                Pair an external IMU sensor
              </ThemedText>
              <View style={[styles.pill, { backgroundColor: palette.pillBg }]}>
                <ThemedText style={[styles.pillText, { color: palette.pillText }]}>
                  Requires custom dev build
                </ThemedText>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.cancelButton}>
            <ThemedText style={[styles.cancelText, { color: palette.accent }]}>Cancel</ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  optionSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  cancelButton: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
