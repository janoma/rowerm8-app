/**
 * StatusPill — a small rounded pill with optional leading icon.
 *
 * Absorbs the green "Ready · WitMotion" pill in the row launcher
 * and is also used for live-data preview pills (e.g. "78 bpm" next
 * to a sensor card). The visual is tighter and more decorative than
 * a `<Banner>`; use this for at-a-glance status, `<Banner>` for
 * messages with body text or actions.
 */

import { type ComponentProps } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import type { IconSymbol } from "@/components/ui/icon-symbol";

import { useTheme } from "../provider";
import type { ColorTokens } from "../tokens/colors";
import { Icon, type IconTone } from "./icon";

export type StatusPillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONE_TO_TOKENS: Record<
  StatusPillTone,
  { bgKey: keyof ColorTokens; textKey: keyof ColorTokens; iconTone: IconTone }
> = {
  neutral: {
    bgKey: "neutralSubtle",
    textKey: "textSecondary",
    iconTone: "textSecondary",
  },
  accent: {
    bgKey: "accentSubtle",
    textKey: "accentText",
    iconTone: "accentText",
  },
  success: {
    bgKey: "successBg",
    textKey: "success",
    iconTone: "success",
  },
  warning: {
    bgKey: "warningBg",
    textKey: "warning",
    iconTone: "warning",
  },
  danger: {
    bgKey: "dangerBg",
    textKey: "dangerText",
    iconTone: "danger",
  },
  info: {
    bgKey: "infoBg",
    textKey: "accentText",
    iconTone: "info",
  },
};

export type StatusPillProps = {
  children: string;
  tone?: StatusPillTone;
  icon?: ComponentProps<typeof IconSymbol>["name"];
  style?: ViewStyle;
};

export function StatusPill({
  children,
  tone = "neutral",
  icon,
  style,
}: StatusPillProps) {
  const { tokens } = useTheme();
  const map = TONE_TO_TOKENS[tone];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: tokens.colors[map.bgKey],
          borderRadius: tokens.radius.pill,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={14} tone={map.iconTone} /> : null}
      <Text style={[styles.label, { color: tokens.colors[map.textKey] }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
});
