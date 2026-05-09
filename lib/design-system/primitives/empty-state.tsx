/**
 * EmptyState — a dashed-border placeholder for "nothing here yet"
 * surfaces (history list, free-row before a sensor is selected).
 *
 * Always centered. Optional `cta` renders a single underlined link
 * beneath the body; for richer affordances drop down to a `<Card>` +
 * `<Button>` composition.
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

export type EmptyStateProps = {
  /** Bold heading line. */
  title?: string;
  /** Body — accepts either a string or a node. */
  children?: ReactNode;
  cta?: { label: string; onPress: () => void };
  style?: ViewStyle;
};

export function EmptyState({ title, children, cta, style }: EmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.root,
        {
          borderColor: tokens.colors.placeholderBorder,
          borderRadius: tokens.radius.lg,
        },
        style,
      ]}
      accessibilityRole="text"
    >
      {title ? (
        <Text style={[styles.title, { color: tokens.colors.placeholderText }]}>
          {title}
        </Text>
      ) : null}
      {typeof children === "string" ? (
        <Text style={[styles.body, { color: tokens.colors.placeholderText }]}>
          {children}
        </Text>
      ) : (
        children
      )}
      {cta ? (
        <Pressable
          onPress={cta.onPress}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          hitSlop={8}
        >
          <Text style={[styles.cta, { color: tokens.colors.accent }]}>
            {cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: 28,
    paddingHorizontal: 18,
    gap: 6,
    alignItems: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  cta: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
  },
});
