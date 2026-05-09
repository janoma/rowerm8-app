/**
 * Button — iOS HIG flavor (also used as the web/default fallback).
 *
 * Three visual variants × three tones = 9 combinations covering
 * every button surface in the app today: free-row's start/stop/discard,
 * activity-detail's share/delete, ble-scan's cancel.
 *
 * Sizes: `md` (44 dp tall — HIG minimum tap target) and `lg` (52 dp
 * for "primary stage" buttons like the live-row record/stop).
 *
 * Android imports its own `.android.tsx` sibling for the MD3 ripple
 * treatment — see button.android.tsx.
 */

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "../provider";
import { type ButtonProps, resolveButtonColors } from "./button.shared";
import { Icon } from "./icon";

export function Button({
  title,
  onPress,
  variant = "filled",
  tone = "accent",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  block = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { tokens } = useTheme();
  const colors = resolveButtonColors(variant, tone, tokens.colors, disabled);
  const isInactive = disabled || loading;

  const sizeStyles = size === "lg" ? styles.large : styles.medium;
  const labelStyles = size === "lg" ? styles.largeLabel : styles.mediumLabel;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        sizeStyles,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: tokens.radius.md,
          alignSelf: block ? "stretch" : "flex-start",
          opacity: disabled ? 0.4 : pressed ? colors.pressedOpacity : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : icon ? (
          <Icon
            name={icon}
            size={size === "lg" ? 22 : 18}
            color={colors.foreground}
          />
        ) : null}
        <Text style={[labelStyles, { color: colors.foreground }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  medium: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  large: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mediumLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  largeLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
});
