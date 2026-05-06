import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    label: "#11181C",
    subtitle: "#687076",
    chevron: "#9BA1A6",
    pressed: "#F2F3F5",
    danger: "#D02E1F",
  },
  dark: {
    label: "#ECEDEE",
    subtitle: "#9BA1A6",
    chevron: "#6E7174",
    pressed: "#26292C",
    danger: "#FF6369",
  },
} as const;

type Props = {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
  /**
   * Optional element rendered on the right side (e.g. a Switch or value text).
   * When omitted and `onPress` is provided, a chevron is shown.
   */
  accessory?: ReactNode;
  accessibilityHint?: string;
};

export function SettingsRow({
  label,
  subtitle,
  onPress,
  destructive,
  accessory,
  accessibilityHint,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];

  const labelColor = destructive ? palette.danger : palette.label;

  const content = (
    <View style={styles.row}>
      <View style={styles.textBlock}>
        <ThemedText style={[styles.label, { color: labelColor }]}>
          {label}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: palette.subtitle }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {accessory ??
        (onPress ? (
          <IconSymbol name="chevron.right" size={18} color={palette.chevron} />
        ) : null)}
    </View>
  );

  if (!onPress) {
    return <View style={styles.container}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.container,
        pressed ? { backgroundColor: palette.pressed } : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 28,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
