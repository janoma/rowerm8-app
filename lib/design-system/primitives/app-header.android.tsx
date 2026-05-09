/**
 * AppHeader — Material Design 3 top-app-bar flavor.
 *
 * Same data shape as the iOS / web variant; renders the title
 * left-aligned with a bare back arrow (no "Back" label) and the
 * trailing slot on the right. Subtitle, if present, sits under the
 * title in a smaller weight.
 */

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
          paddingTop: Math.max(insets.top, 8),
          backgroundColor: tokens.colors.surface,
        },
      ]}
    >
      <View style={styles.bar}>
        {leading ? (
          <View style={styles.backButton}>{leading}</View>
        ) : onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            android_ripple={{
              color: `${tokens.colors.text}1F`,
              radius: 24,
              borderless: true,
            }}
            style={styles.backButton}
          >
            <Icon name="chevron.left" size={24} tone="text" />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <View style={styles.titleSlot}>
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

const styles = StyleSheet.create({
  safeTop: {
    paddingHorizontal: 4,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSlot: {
    flex: 1,
    paddingHorizontal: 4,
  },
  trailingSlot: {
    minWidth: 48,
    alignItems: "flex-end",
    paddingRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 14,
    marginTop: 2,
  },
});
