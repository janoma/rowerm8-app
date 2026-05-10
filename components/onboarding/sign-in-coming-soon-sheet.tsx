import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button, useTheme } from "@/lib/design-system";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/**
 * Centered "sign-in coming soon" alert. Surfaced when the user taps the
 * `Sign in` button on the `LoginBlock`. Dismissing it falls the user back
 * to the guest experience (the orchestrator handles the status transition).
 *
 * Modeled after the platform alert pattern (`SensorPlacementModal`-style)
 * so it feels native on both iOS and Android without dragging in another
 * dialog library.
 */
export function SignInComingSoonSheet({ visible, onDismiss }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("auth");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View
        style={[styles.backdrop, { backgroundColor: tokens.colors.overlay }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        >
          <ThemedText style={[styles.title, { color: tokens.colors.text }]}>
            {t("comingSoon.title")}
          </ThemedText>
          <ThemedText
            style={[styles.body, { color: tokens.colors.textSecondary }]}
          >
            {t("comingSoon.body")}
          </ThemedText>
          <Button
            title={t("comingSoon.continue")}
            onPress={onDismiss}
            variant="filled"
            tone="accent"
            block
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    paddingBottom: 4,
  },
});
