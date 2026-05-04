import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

const COLORS = {
  light: {
    accent: '#0a7ea4',
    iconColor: '#0a7ea4',
    title: '#11181C',
    subtitle: '#687076',
    coreBg: 'rgba(10, 126, 164, 0.18)',
    inactiveBg: '#E4E6EA',
    inactiveTitle: '#11181C',
    inactiveIcon: '#687076',
  },
  dark: {
    accent: '#3DB7E0',
    iconColor: '#3DB7E0',
    title: '#ECEDEE',
    subtitle: '#9BA1A6',
    coreBg: 'rgba(61, 183, 224, 0.22)',
    inactiveBg: '#2A2D30',
    inactiveTitle: '#ECEDEE',
    inactiveIcon: '#9BA1A6',
  },
} as const;

const RING_COUNT = 3;
const PULSE_DURATION_MS = 1800;

type Props = {
  scanning: boolean;
  title: string;
  subtitle?: string;
};

export function ScanHero({ scanning, title, subtitle }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = COLORS[scheme];

  const ringDelays = useMemo(
    () => Array.from({ length: RING_COUNT }, (_, i) => (i * PULSE_DURATION_MS) / RING_COUNT),
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.ringStage}>
        {scanning
          ? ringDelays.map((delay, i) => (
              <PulseRing key={i} delay={delay} accent={palette.accent} />
            ))
          : null}
        <View
          style={[
            styles.core,
            { backgroundColor: scanning ? palette.coreBg : palette.inactiveBg },
          ]}>
          <IconSymbol
            name="dot.radiowaves.right"
            size={28}
            color={scanning ? palette.iconColor : palette.inactiveIcon}
          />
        </View>
      </View>
      <ThemedText style={[styles.title, { color: palette.title }]}>{title}</ThemedText>
      {subtitle ? (
        <ThemedText style={[styles.subtitle, { color: palette.subtitle }]}>{subtitle}</ThemedText>
      ) : null}
    </View>
  );
}

function PulseRing({ delay, accent }: { delay: number; accent: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withRepeat(
        withTiming(1, { duration: PULSE_DURATION_MS, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.45 + progress.value * 0.95 }],
    opacity: 1 - progress.value,
  }));

  return <Animated.View style={[styles.ring, { borderColor: accent }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  ringStage: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
  },
  core: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
