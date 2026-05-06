import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    backdrop: "rgba(0, 0, 0, 0.35)",
    sheet: "#FFFFFF",
    grabber: "#C7C9CC",
    cardEnabled: "#F2F3F5",
    cardEnabledBorder: "#E4E6EA",
    title: "#11181C",
    subtitle: "#687076",
    accent: "#0a7ea4",
    accentSoft: "rgba(10, 126, 164, 0.18)",
    chevron: "#687076",
    danger: "#D02E1F",
    dangerSoft: "rgba(208, 46, 31, 0.12)",
  },
  dark: {
    backdrop: "rgba(0, 0, 0, 0.55)",
    sheet: "#1B1D1F",
    grabber: "#3A3D40",
    cardEnabled: "#26292C",
    cardEnabledBorder: "#2F3236",
    title: "#ECEDEE",
    subtitle: "#9BA1A6",
    accent: "#3DB7E0",
    accentSoft: "rgba(61, 183, 224, 0.22)",
    chevron: "#9BA1A6",
    danger: "#FF6369",
    dangerSoft: "rgba(255, 99, 105, 0.18)",
  },
} as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectPhone: () => void;
  /**
   * If provided, renders a destructive "Disconnect" row at the bottom that
   * clears the active sensor selection. Pass undefined when no source is
   * currently selected (the row would be a no-op).
   */
  onDisconnect?: () => void;
};

export function SensorPickerSheet({
  visible,
  onClose,
  onSelectPhone,
  onDisconnect,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];
  const { t } = useTranslation("sensor");
  const { t: tc } = useTranslation("common");

  const handleBluetoothPress = () => {
    onClose();
    router.push("/ble-scan");
  };

  const handleDisconnectPress = () => {
    onDisconnect?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: palette.backdrop }]}
        onPress={onClose}
      />
      <View style={styles.sheetWrapper} pointerEvents="box-none">
        <SafeAreaView
          edges={["bottom"]}
          style={[styles.sheet, { backgroundColor: palette.sheet }]}
        >
          <View
            style={[styles.grabber, { backgroundColor: palette.grabber }]}
          />
          <ThemedText style={[styles.title, { color: palette.title }]}>
            {t("picker.title")}
          </ThemedText>

          <Pressable
            onPress={() => {
              onSelectPhone();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("picker.phone.a11y")}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: palette.cardEnabled,
                borderColor: palette.cardEnabledBorder,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.optionIcon,
                { backgroundColor: palette.accentSoft },
              ]}
            >
              <IconSymbol name="iphone" size={24} color={palette.accent} />
            </View>
            <View style={styles.optionTextBlock}>
              <ThemedText
                style={[styles.optionTitle, { color: palette.title }]}
              >
                {t("picker.phone.title")}
              </ThemedText>
              <ThemedText
                style={[styles.optionSubtitle, { color: palette.subtitle }]}
              >
                {t("picker.phone.subtitle")}
              </ThemedText>
            </View>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={palette.chevron}
            />
          </Pressable>

          <Pressable
            onPress={handleBluetoothPress}
            accessibilityRole="button"
            accessibilityLabel={t("picker.ble.a11y")}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: palette.cardEnabled,
                borderColor: palette.cardEnabledBorder,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.optionIcon,
                { backgroundColor: palette.accentSoft },
              ]}
            >
              <IconSymbol
                name="dot.radiowaves.right"
                size={24}
                color={palette.accent}
              />
            </View>
            <View style={styles.optionTextBlock}>
              <ThemedText
                style={[styles.optionTitle, { color: palette.title }]}
              >
                {t("picker.ble.title")}
              </ThemedText>
              <ThemedText
                style={[styles.optionSubtitle, { color: palette.subtitle }]}
              >
                {t("picker.ble.subtitle")}
              </ThemedText>
            </View>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={palette.chevron}
            />
          </Pressable>

          {onDisconnect ? (
            <Pressable
              onPress={handleDisconnectPress}
              accessibilityRole="button"
              accessibilityLabel={t("picker.disconnect.a11y")}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: palette.cardEnabled,
                  borderColor: palette.cardEnabledBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.optionIcon,
                  { backgroundColor: palette.dangerSoft },
                ]}
              >
                <IconSymbol
                  name="xmark.circle"
                  size={24}
                  color={palette.danger}
                />
              </View>
              <View style={styles.optionTextBlock}>
                <ThemedText
                  style={[styles.optionTitle, { color: palette.danger }]}
                >
                  {t("picker.disconnect.title")}
                </ThemedText>
                <ThemedText
                  style={[styles.optionSubtitle, { color: palette.subtitle }]}
                >
                  {t("picker.disconnect.subtitle")}
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.cancelButton}
          >
            <ThemedText style={[styles.cancelText, { color: palette.accent }]}>
              {tc("actions.cancel")}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  optionSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  cancelButton: {
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: "600",
  },
});
