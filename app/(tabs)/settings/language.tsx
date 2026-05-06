import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLocale } from "@/contexts/locale-context";
import {
  type SupportedLanguageCode,
  SUPPORTED_LANGUAGES,
  isReloadRequiredForLanguage,
  reloadApp,
} from "@/lib/i18n";
import { useColorScheme } from "@/hooks/use-color-scheme";

const TINT = { light: "#0a7ea4", dark: "#3DB7E0" } as const;

export default function LanguagePickerScreen() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { prefs, resolved, setPref } = useLocale();
  const scheme = useColorScheme() ?? "light";
  const tint = TINT[scheme];

  const choose = (next: "auto" | SupportedLanguageCode) => {
    const prevLang = resolved.language;
    setPref("language", next);
    // Resolved next language: if "auto", we'd need to recompute; reading
    // resolved on the next render is the easiest way. We approximate by
    // checking only when an explicit non-auto language is chosen.
    if (next !== "auto" && isReloadRequiredForLanguage(prevLang, next)) {
      const direction = next === "ar" ? "rtl" : "ltr";
      Alert.alert(
        t("language.rtlReloadAlert.title"),
        t("language.rtlReloadAlert.message", { direction }),
        [
          { text: t("language.rtlReloadAlert.later"), style: "cancel" },
          {
            text: t("language.rtlReloadAlert.confirm"),
            onPress: () => {
              void reloadApp();
            },
          },
        ],
      );
    }
  };

  const isSelected = (code: "auto" | SupportedLanguageCode) =>
    prefs.language === code;

  return (
    <ThemedView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection footer={t("language.pickerFooter")}>
          <SettingsRow
            label={tc("system.auto")}
            accessory={
              isSelected("auto") ? (
                <IconSymbol name="checkmark" size={20} color={tint} />
              ) : null
            }
            onPress={() => choose("auto")}
          />
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SettingsRow
              key={lang.code}
              label={lang.nativeName}
              subtitle={lang.englishName}
              accessory={
                isSelected(lang.code) ? (
                  <IconSymbol name="checkmark" size={20} color={tint} />
                ) : null
              }
              onPress={() => choose(lang.code)}
            />
          ))}
        </SettingsSection>

        <View style={styles.spacer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 18,
  },
  spacer: {
    height: 16,
  },
});
