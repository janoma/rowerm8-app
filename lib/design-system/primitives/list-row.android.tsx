/**
 * ListRow — Material Design 3 flavor.
 *
 * Same API as the iOS / web variant; replaces the pressed-state
 * dimming with a native ripple via `android_ripple` for that
 * MD3 state-layer feel.
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
      android_ripple={{
        color: `${tokens.colors.text}1F`,
      }}
      style={[styles.container, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
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
    fontSize: 14,
    lineHeight: 18,
  },
});
