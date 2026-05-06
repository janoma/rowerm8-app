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
   * Element rendered on the right side. Three possible values:
   *   - omitted (`undefined`): if `onPress` is set, a chevron is shown to
   *     indicate this row pushes to another screen.
   *   - `null`: explicitly suppress the chevron — used by option-selector
   *     rows where the row is pressable but doesn't navigate (e.g. the
   *     "Metric / Imperial" pickers, where the right side is either a
   *     checkmark or empty).
   *   - any node: rendered as-is (e.g. a checkmark, switch, or value text).
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

  // Explicit `null` means "no trailing widget"; only an undefined `accessory`
  // falls back to the chevron. This lets selector rows render either a
  // checkmark or nothing without accidentally implying a sub-screen.
  const trailing =
    accessory !== undefined ? (
      accessory
    ) : onPress ? (
      <IconSymbol name="chevron.right" size={18} color={palette.chevron} />
    ) : null;

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
      {trailing}
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
