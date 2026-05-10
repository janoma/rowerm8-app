import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { APP_NAME } from "@/constants/branding";
import { Button, Stack, useTheme } from "@/lib/design-system";

type Props = {
  onContinueAsGuest: () => void;
  onSignIn: () => void;
};

/**
 * The "Welcome / Continue as Guest / Sign in" surface shown on every cold
 * start (until the user is signed in) and again whenever the user taps the
 * Home avatar.
 *
 * Intentionally not dismissible from outside — the only way out is one of
 * the two CTAs. The sign-in CTA is a stub today; the orchestrator
 * (`OnboardingOverlay`) renders the "coming soon" sheet on top of this when
 * it fires.
 */
export function LoginBlock({ onContinueAsGuest, onSignIn }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("auth");

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.heroBlock}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: tokens.colors.accentSubtle },
            ]}
          >
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.icon}
              accessible={false}
            />
          </View>
          <ThemedText
            type="title"
            style={[styles.title, { color: tokens.colors.text }]}
          >
            {t("welcome.title", { appName: APP_NAME })}
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: tokens.colors.textSecondary }]}
          >
            {t("welcome.subtitle")}
          </ThemedText>
        </View>

        <Stack gap="sm" style={styles.actions}>
          <Button
            title={t("welcome.signIn")}
            onPress={onSignIn}
            variant="filled"
            tone="accent"
            size="lg"
            block
          />
          <Button
            title={t("welcome.continueAsGuest")}
            onPress={onContinueAsGuest}
            variant="tinted"
            tone="neutral"
            size="lg"
            block
          />
        </Stack>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
    gap: 32,
  },
  heroBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  title: {
    textAlign: "center",
    paddingHorizontal: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  actions: {
    width: "100%",
  },
});
