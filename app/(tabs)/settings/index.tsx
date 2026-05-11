import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  ONBOARDING_FEATURES_SEEN_KEY,
  PLACEMENT_DONT_SHOW_KEY,
} from "@/constants/storage-keys";
import { useLocale } from "@/contexts/locale-context";
import { useProfile } from "@/contexts/profile-context";
import { useAutoStartPref } from "@/hooks/use-auto-start-pref";
import { Switch, useTheme } from "@/lib/design-system";
import { findLanguage } from "@/lib/i18n";
import { kilogramsToPounds } from "@/lib/units";

export default function SettingsScreen() {
  const { t } = useTranslation("settings");
  const { prefs, resolved } = useLocale();
  const { resolved: profile } = useProfile();
  const { prefScheme, scheme } = useTheme();
  const { enabled: autoStartEnabled, setEnabled: setAutoStartEnabled } =
    useAutoStartPref();

  // Both toggles map to "key absent => screen will show on next trigger".
  // We start with `null` while hydrating from AsyncStorage so the Switch
  // doesn't flash a wrong state on mount for users who had previously
  // dismissed the corresponding screen.
  const [showWelcomeSlides, setShowWelcomeSlides] = useState<boolean | null>(
    null,
  );
  const [showPlacementInstructions, setShowPlacementInstructions] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(ONBOARDING_FEATURES_SEEN_KEY),
      AsyncStorage.getItem(PLACEMENT_DONT_SHOW_KEY),
    ])
      .then(([seen, placementDontShow]) => {
        if (cancelled) {
          return;
        }
        setShowWelcomeSlides(seen !== "true");
        setShowPlacementInstructions(placementDontShow !== "true");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        // Treat a storage failure as "never dismissed" so the user can
        // still see and operate the toggles. Worst case, the underlying
        // screens will reappear on their next trigger.
        setShowWelcomeSlides(true);
        setShowPlacementInstructions(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleWelcomeSlides = useCallback((next: boolean) => {
    setShowWelcomeSlides(next);
    const op = next
      ? AsyncStorage.removeItem(ONBOARDING_FEATURES_SEEN_KEY)
      : AsyncStorage.setItem(ONBOARDING_FEATURES_SEEN_KEY, "true");
    op.catch(() => {});
  }, []);

  const handleTogglePlacementInstructions = useCallback((next: boolean) => {
    setShowPlacementInstructions(next);
    const op = next
      ? AsyncStorage.removeItem(PLACEMENT_DONT_SHOW_KEY)
      : AsyncStorage.setItem(PLACEMENT_DONT_SHOW_KEY, "true");
    op.catch(() => {});
  }, []);

  const languageNative =
    findLanguage(resolved.language)?.nativeName ?? resolved.language;
  const languageSubtitle =
    prefs.language === "auto"
      ? t("language.row.subtitleAuto", { language: languageNative })
      : t("language.row.subtitle", { language: languageNative });

  const unitsSubtitle = describeUnits(prefs, resolved, t);

  const profileSubtitle = profile.isCustomized
    ? t("profile.row.subtitleCustom", {
        maxHr: profile.maxHrBpm,
        weight:
          resolved.weightUnit === "kg"
            ? profile.weightKg
            : Math.round(kilogramsToPounds(profile.weightKg)),
        weightUnit: resolved.weightUnit === "kg" ? " kg" : " lb",
      })
    : t("profile.row.subtitleDefault");

  // Mirror the language-row pattern: when the user is on "auto", show
  // what the OS resolves to right now in parens; otherwise just the
  // pinned value.
  const appearanceValue = t(`appearance.inline.${scheme}`);
  const appearanceSubtitle =
    prefScheme === "auto"
      ? t("appearance.row.subtitleAuto", { value: appearanceValue })
      : t("appearance.row.subtitle", { value: appearanceValue });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.title}>
            {t("title")}
          </ThemedText>

          <View style={styles.sections}>
            <SettingsSection header={t("sections.appearance")}>
              <SettingsRow
                label={t("appearance.row.label")}
                subtitle={appearanceSubtitle}
                onPress={() => router.push("/settings/appearance")}
              />
            </SettingsSection>

            <SettingsSection header={t("sections.language")}>
              <SettingsRow
                label={t("language.row.label")}
                subtitle={languageSubtitle}
                onPress={() => router.push("/settings/language")}
              />
            </SettingsSection>

            <SettingsSection header={t("sections.units")}>
              <SettingsRow
                label={t("sections.units")}
                subtitle={unitsSubtitle}
                onPress={() => router.push("/settings/units")}
              />
            </SettingsSection>

            <SettingsSection header={t("sections.profile")}>
              <SettingsRow
                label={t("profile.row.label")}
                subtitle={profileSubtitle}
                onPress={() => router.push("/settings/profile")}
              />
            </SettingsSection>

            <SettingsSection header={t("sections.recording")}>
              <SettingsRow
                label={t("recording.autoStart.label")}
                subtitle={t("recording.autoStart.subtitle")}
                accessory={
                  <Switch
                    value={autoStartEnabled ?? false}
                    onValueChange={setAutoStartEnabled}
                    disabled={autoStartEnabled === null}
                    accessibilityLabel={t("recording.autoStart.label")}
                  />
                }
              />
            </SettingsSection>

            <SettingsSection header={t("sections.help")}>
              <SettingsRow
                label={t("help.showWelcomeSlides.label")}
                subtitle={t("help.showWelcomeSlides.subtitle")}
                accessory={
                  <Switch
                    value={showWelcomeSlides ?? false}
                    onValueChange={handleToggleWelcomeSlides}
                    disabled={showWelcomeSlides === null}
                    accessibilityLabel={t("help.showWelcomeSlides.label")}
                  />
                }
              />
              <SettingsRow
                label={t("help.showPlacementInstructions.label")}
                subtitle={t("help.showPlacementInstructions.subtitle")}
                accessory={
                  <Switch
                    value={showPlacementInstructions ?? false}
                    onValueChange={handleTogglePlacementInstructions}
                    disabled={showPlacementInstructions === null}
                    accessibilityLabel={t(
                      "help.showPlacementInstructions.label",
                    )}
                  />
                }
              />
            </SettingsSection>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function describeUnits(
  prefs: ReturnType<typeof useLocale>["prefs"],
  resolved: ReturnType<typeof useLocale>["resolved"],
  t: (key: string) => string,
): string {
  const systemKey =
    prefs.measurementSystem === "auto"
      ? resolved.measurementSystem
      : prefs.measurementSystem;
  const systemLabel = t(`units.system.${systemKey}`);
  const paceLabel = t(`units.pace.${prefs.paceUnit}`);
  return `${systemLabel} \u00B7 ${paceLabel}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 18,
  },
  title: {
    marginBottom: 4,
  },
  sections: {
    gap: 24,
  },
});
