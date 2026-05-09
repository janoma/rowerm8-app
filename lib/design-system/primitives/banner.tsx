/**
 * Banner — a full-width tinted notice block.
 *
 * Replaces the inline "Notice" view re-implemented in
 * `app/(tabs)/row.tsx` and `app/free-row.tsx`, plus the success
 * "savedNotice" pattern in `free-row.tsx`. Tones map 1:1 to the
 * status color families in `colors.ts`.
 *
 * The optional `action` prop renders a trailing button-style label
 * (used by the row launcher's "Go home" affordance). It does NOT
 * pull in the `Button` primitive on purpose — the affordance is
 * meant to be visually subordinate to the message.
 */

import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../provider";
import type { ColorTokens } from "../tokens/colors";

export type BannerTone = "info" | "warning" | "success" | "danger";

const TONE_TO_TOKENS: Record<
  BannerTone,
  {
    bgKey: keyof ColorTokens;
    borderKey: keyof ColorTokens;
    textKey: keyof ColorTokens;
    actionKey: keyof ColorTokens;
  }
> = {
  info: {
    bgKey: "infoBg",
    borderKey: "infoBorder",
    textKey: "accentText",
    actionKey: "accent",
  },
  warning: {
    bgKey: "warningBg",
    borderKey: "warningBorder",
    textKey: "warningText",
    actionKey: "accent",
  },
  success: {
    bgKey: "successBg",
    borderKey: "successBorder",
    textKey: "successText",
    actionKey: "successText",
  },
  danger: {
    bgKey: "dangerBg",
    borderKey: "dangerBorder",
    textKey: "dangerText",
    actionKey: "dangerText",
  },
};

export type BannerProps = {
  children: ReactNode;
  tone?: BannerTone;
  /** Optional trailing action (e.g. "Go home", "Retry"). */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Optional title rendered above `children` in a heavier weight. */
  title?: string;
  style?: ViewStyle;
};

export function Banner({
  children,
  tone = "info",
  action,
  title,
  style,
}: BannerProps) {
  const { tokens } = useTheme();
  const map = TONE_TO_TOKENS[tone];
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: tokens.colors[map.bgKey],
          borderColor: tokens.colors[map.borderKey],
          borderRadius: tokens.radius.md,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: tokens.colors[map.textKey] }]}>
            {title}
          </Text>
        ) : null}
        {typeof children === "string" ? (
          <Text style={[styles.body, { color: tokens.colors[map.textKey] }]}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          hitSlop={6}
        >
          <Text
            style={[styles.action, { color: tokens.colors[map.actionKey] }]}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    lineHeight: 18,
  },
  action: {
    fontSize: 14,
    fontWeight: "600",
  },
});
