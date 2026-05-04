import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveAccelerationCard } from '@/components/sensor/live-acceleration-card';
import { SensorPickerSheet } from '@/components/sensor/sensor-picker-sheet';
import { SensorStatusCard } from '@/components/sensor/sensor-status-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useMotionSensor } from '@/contexts/motion-sensor-context';
import { useAccelerometerStream } from '@/hooks/use-accelerometer-stream';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SAMPLE_RATE_HZ = 60;

const COLORS = {
  light: {
    helper: '#687076',
    placeholderBorder: '#D1D5DA',
    placeholderText: '#9BA1A6',
    primaryBg: '#0a7ea4',
    primaryText: '#FFFFFF',
    permissionBg: 'rgba(224, 138, 30, 0.12)',
    permissionBorder: 'rgba(224, 138, 30, 0.4)',
    permissionText: '#9C5E0E',
  },
  dark: {
    helper: '#9BA1A6',
    placeholderBorder: '#2F3236',
    placeholderText: '#6E7174',
    primaryBg: '#0a7ea4',
    primaryText: '#FFFFFF',
    permissionBg: 'rgba(255, 176, 32, 0.14)',
    permissionBorder: 'rgba(255, 176, 32, 0.45)',
    permissionText: '#FFB020',
  },
} as const;

export default function RowScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = COLORS[scheme];
  const { source, deviceLabel, selectPhone } = useMotionSensor();
  const [pickerOpen, setPickerOpen] = useState(false);

  const phoneActive = source === 'phone';
  const stream = useAccelerometerStream({
    enabled: phoneActive,
    sampleRateHz: SAMPLE_RATE_HZ,
  });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Row
          </ThemedText>

          <SensorStatusCard
            selected={source !== 'none'}
            deviceLabel={deviceLabel}
            onPressAction={() => setPickerOpen(true)}
          />

          {source === 'none' ? (
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Select motion sensor"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: palette.primaryBg, opacity: pressed ? 0.85 : 1 },
              ]}>
              <IconSymbol
                name="dot.radiowaves.left.and.right"
                size={20}
                color={palette.primaryText}
              />
              <ThemedText style={[styles.primaryButtonText, { color: palette.primaryText }]}>
                Select motion sensor
              </ThemedText>
            </Pressable>
          ) : null}

          {source === 'none' ? (
            <ThemedText style={[styles.helper, { color: palette.helper }]}>
              Choose how you want to track stroke motion.
            </ThemedText>
          ) : null}

          {phoneActive ? (
            stream.permissionDenied ? (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: palette.permissionBg, borderColor: palette.permissionBorder },
                ]}>
                <ThemedText style={[styles.noticeText, { color: palette.permissionText }]}>
                  Motion permission was denied. Enable Motion &amp; Fitness for rowerm8 in Settings to
                  see live data.
                </ThemedText>
              </View>
            ) : !stream.isAvailable ? (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: palette.permissionBg, borderColor: palette.permissionBorder },
                ]}>
                <ThemedText style={[styles.noticeText, { color: palette.permissionText }]}>
                  No accelerometer detected on this device.
                </ThemedText>
              </View>
            ) : (
              <LiveAccelerationCard
                sample={stream.sample}
                histories={stream.histories}
                sampleRateHz={stream.sampleRateHz}
              />
            )
          ) : source === 'none' ? (
            <View
              style={[styles.placeholder, { borderColor: palette.placeholderBorder }]}
              accessibilityElementsHidden>
              <ThemedText style={[styles.placeholderText, { color: palette.placeholderText }]}>
                Live sensor data will appear here once you select a source.
              </ThemedText>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <SensorPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectPhone={selectPhone}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 18,
  },
  title: {
    marginBottom: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  helper: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: -6,
  },
  placeholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 18,
  },
});
