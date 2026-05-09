import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";

import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type ThemePref, useTheme } from "@/lib/design-system";

const OPTIONS: ThemePref[] = ["auto", "light", "dark"];

export default function AppearancePickerScreen() {
  const { t } = useTranslation("settings");
  const { prefScheme, scheme, setPrefScheme, tokens } = useTheme();

  const checkmark = (selected: boolean) =>
    selected ? (
      <IconSymbol name="checkmark" size={20} color={tokens.colors.accent} />
    ) : null;

  // The "auto" row previews which scheme the OS would pick right now
  // (e.g. "Follow system (dark)") so the user knows what tapping it
  // would do. The other rows show their static label.
  const labelFor = (opt: ThemePref): string => {
    if (opt === "auto") {
      return (
        t("appearance.options.auto") + ` (${t(`appearance.inline.${scheme}`)})`
      );
    }
    return t(`appearance.options.${opt}`);
  };

  return (
    <ThemedView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection
          header={t("appearance.pickerTitle")}
          footer={t("appearance.pickerFooter")}
        >
          {OPTIONS.map((opt) => (
            <SettingsRow
              key={opt}
              label={labelFor(opt)}
              accessory={checkmark(prefScheme === opt)}
              onPress={() => setPrefScheme(opt)}
            />
          ))}
        </SettingsSection>
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
});
