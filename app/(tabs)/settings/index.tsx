import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { PLACEMENT_DONT_SHOW_KEY } from "@/constants/storage-keys";
import { useLocale } from "@/contexts/locale-context";
import { useTheme } from "@/lib/design-system";
import { findLanguage } from "@/lib/i18n";

export default function SettingsScreen() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { prefs, resolved } = useLocale();
  const { prefScheme, scheme } = useTheme();

  const handleResetPlacement = () => {
    Alert.alert(
      t("help.resetPlacement.alert.title"),
      t("help.resetPlacement.alert.message"),
      [
        { text: tc("actions.cancel"), style: "cancel" },
        {
          text: t("help.resetPlacement.alert.confirm"),
          style: "destructive",
          onPress: () => {
            AsyncStorage.removeItem(PLACEMENT_DONT_SHOW_KEY).catch(() => {});
          },
        },
      ],
    );
  };

  const languageNative =
    findLanguage(resolved.language)?.nativeName ?? resolved.language;
  const languageSubtitle =
    prefs.language === "auto"
      ? t("language.row.subtitleAuto", { language: languageNative })
      : t("language.row.subtitle", { language: languageNative });

  const unitsSubtitle = describeUnits(prefs, resolved, t);

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

            <SettingsSection
              header={t("sections.help")}
              footer={t("help.resetPlacement.footer")}
            >
              <SettingsRow
                label={t("help.resetPlacement.label")}
                subtitle={t("help.resetPlacement.subtitle")}
                destructive
                onPress={handleResetPlacement}
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
