/**
 * ListRow — iOS HIG flavor (also the web/default fallback).
 *
 * Standard UITableViewCell-style row: 44 dp tap target, leading
 * inset of 16 dp, optional leading icon + label/subtitle text block
 * + trailing accessory (chevron / checkmark / value).
 *
 * The Android sibling (list-row.android.tsx) replaces the pressed
 * dimming with an MD3 ripple.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../provider";
import { Icon } from "./icon";
import { type ListRowProps } from "./list-row.shared";

export function ListRow({
  label,
  subtitle,
  icon,
  accessory,
  onPress,
  destructive = false,
  accessibilityHint,
  style,
}: ListRowProps) {
  const { tokens } = useTheme();
  const labelColor = destructive
    ? tokens.colors.dangerText
    : tokens.colors.text;

  const trailing =
    accessory !== undefined ? (
      accessory
    ) : onPress ? (
      <Icon name="chevron.right" size={18} tone="textTertiary" />
    ) : null;

  const content = (
    <View style={styles.row}>
      {icon ? (
        <Icon
          name={icon}
          size={20}
          tone={destructive ? "danger" : "textSecondary"}
        />
      ) : null}
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: tokens.colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return <View style={[styles.container, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.container,
        pressed ? { backgroundColor: tokens.colors.surfaceSunken } : null,
        style,
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
