/**
 * AppHeader — modal-screen nav bar (iOS / web flavor).
 *
 * Replaces the bespoke nav-bar markup duplicated across `free-row`,
 * `activity/[id]`, and `ble-scan`. This iOS variant follows the HIG:
 *   - chevron + back label on the leading edge,
 *   - centered title,
 *   - optional trailing widget on the right.
 *
 * The Android sibling renders the same data as an MD3 top-app-bar
 * (left-aligned title, back arrow only).
 *
 * Use this from screens that disable the navigator's own header
 * via `headerShown: false` — see `app/_layout.tsx`'s `Stack.Screen`
 * registrations.
 */

import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../provider";
import { type AppHeaderProps } from "./app-header.shared";
import { Icon } from "./icon";

export function AppHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  leading,
  trailing,
}: AppHeaderProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.safeTop,
        {
          paddingTop: Math.max(insets.top, 12),
          backgroundColor: tokens.colors.surface,
        },
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.leadingSlot}>
          {leading ?? renderLeading(onBack, backLabel, tokens.colors.accent)}
        </View>
        <View style={styles.titleSlot} pointerEvents="none">
          <Text
            numberOfLines={1}
            style={[styles.title, { color: tokens.colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: tokens.colors.textSecondary }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.trailingSlot}>{trailing ?? null}</View>
      </View>
    </View>
  );
}

function renderLeading(
  onBack: AppHeaderProps["onBack"],
  label: string,
  accent: string,
): ReactNode {
  if (!onBack) {
    return null;
  }
  return (
    <Pressable
      onPress={onBack}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.backButton}
    >
      <Icon name="chevron.left" size={20} color={accent} />
      <Text style={[styles.backLabel, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeTop: {
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
  },
  leadingSlot: {
    minWidth: 70,
    alignItems: "flex-start",
  },
  titleSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  trailingSlot: {
    minWidth: 70,
    alignItems: "flex-end",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: "500",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 14,
    marginTop: 1,
  },
});
