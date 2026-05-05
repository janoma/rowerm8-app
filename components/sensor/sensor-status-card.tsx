import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    surface: "#F2F3F5",
    surfaceBorder: "#E4E6EA",
    label: "#687076",
    accent: "#0a7ea4",
    success: "#1F9D55",
    warning: "#E08A1E",
    warningBg: "rgba(224, 138, 30, 0.15)",
    successBg: "rgba(31, 157, 85, 0.15)",
  },
  dark: {
    surface: "#1F2224",
    surfaceBorder: "#2A2D30",
    label: "#9BA1A6",
    accent: "#3DB7E0",
    success: "#34C759",
    warning: "#FFB020",
    warningBg: "rgba(255, 176, 32, 0.18)",
    successBg: "rgba(52, 199, 89, 0.18)",
  },
} as const;

type Props = {
  selected: boolean;
  deviceLabel: string | null;
  onPressAction: () => void;
};

export function SensorStatusCard({
  selected,
  deviceLabel,
  onPressAction,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];

  const iconName = selected
    ? "checkmark.circle.fill"
    : "exclamationmark.triangle.fill";
  const badgeColor = selected ? palette.success : palette.warning;
  const badgeBg = selected ? palette.successBg : palette.warningBg;
  const valueText = selected ? (deviceLabel ?? "Selected") : "Not selected";
  const actionText = selected ? "Change" : "Select";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
        },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
        <IconSymbol name={iconName} size={26} color={badgeColor} />
      </View>
      <View style={styles.textBlock}>
        <ThemedText style={[styles.label, { color: palette.label }]}>
          MOTION SENSOR
        </ThemedText>
        <ThemedText style={styles.value} numberOfLines={1}>
          {valueText}
        </ThemedText>
      </View>
      {selected ? (
        <Pressable
          onPress={onPressAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Change motion sensor"
        >
          <ThemedText style={[styles.action, { color: palette.accent }]}>
            {actionText}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  value: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  action: {
    fontSize: 16,
    fontWeight: "500",
  },
});
