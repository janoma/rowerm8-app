/**
 * LauncherCard — a tinted CTA card with an icon bubble, title,
 * subtitle, and trailing chevron.
 *
 * Absorbs the inline `LauncherButton` helper from
 * `app/(tabs)/row.tsx`. Two tones:
 *   - `accent`  — the primary CTA, tinted with the brand teal.
 *   - `neutral` — secondary CTA, tinted with a soft gray.
 *
 * The `disabled` prop dims the card and removes the press affordance,
 * but does not visually hide the chevron — it just communicates "this
 * action exists but isn't available right now".
 */

import { type ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import type { IconSymbol } from "@/components/ui/icon-symbol";

import { useTheme } from "../provider";
import type { ColorTokens } from "../tokens/colors";
import { Icon } from "./icon";

export type LauncherTone = "accent" | "neutral";

const TONE_TO_TOKENS: Record<
  LauncherTone,
  {
    fillKey: keyof ColorTokens;
    borderKey: keyof ColorTokens;
    iconKey: keyof ColorTokens;
  }
> = {
  accent: {
    fillKey: "accentSubtle",
    borderKey: "accentSubtleBorder",
    iconKey: "accent",
  },
  neutral: {
    fillKey: "neutralSubtle",
    borderKey: "neutralSubtleBorder",
    iconKey: "textSecondary",
  },
};

export type LauncherCardProps = {
  tone?: LauncherTone;
  iconName: ComponentProps<typeof IconSymbol>["name"];
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function LauncherCard({
  tone = "accent",
  iconName,
  title,
  subtitle,
  disabled = false,
  onPress,
  accessibilityLabel,
  style,
}: LauncherCardProps) {
  const { tokens } = useTheme();
  const map = TONE_TO_TOKENS[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: tokens.colors[map.fillKey],
          borderColor: tokens.colors[map.borderKey],
          borderRadius: tokens.radius.lg,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconBubble,
          {
            backgroundColor: tokens.colors.surfaceElevated,
            borderRadius: tokens.radius.pill,
          },
        ]}
      >
        <Icon name={iconName} size={28} color={tokens.colors[map.iconKey]} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: tokens.colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: tokens.colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron.right" size={20} tone="textTertiary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
});
