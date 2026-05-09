/**
 * Button — Material Design 3 flavor.
 *
 * Same API as the iOS / web variant (button.tsx) but with MD3 shape:
 *   - smaller corner radius (8 dp)
 *   - native ripple via `android_ripple` for the pressed state
 *   - tighter horizontal padding to match MD3 button specs
 *   - state-layer-friendly opacity (no manual pressed dimming)
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

  // Ripple uses the foreground color at low alpha for "tinted"/"plain"
  // variants (where the background is light), and the on-accent text
  // color for "filled" (where ripple needs to sit on a saturated bg).
  const rippleColor =
    variant === "filled" ? `${colors.foreground}33` : `${colors.foreground}22`;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      android_ripple={{ color: rippleColor }}
      style={[
        styles.base,
        sizeStyles,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: tokens.radius.sm,
          alignSelf: block ? "stretch" : "flex-start",
          opacity: disabled ? 0.4 : 1,
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
    overflow: "hidden",
  },
  medium: {
    minHeight: 40,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  large: {
    minHeight: 48,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mediumLabel: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  largeLabel: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
