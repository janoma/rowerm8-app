import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";

import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type LocalePrefs, useLocale } from "@/contexts/locale-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

const TINT = { light: "#0a7ea4", dark: "#3DB7E0" } as const;

type SystemOption = LocalePrefs["measurementSystem"];
type PaceOption = LocalePrefs["paceUnit"];
type WeightOption = LocalePrefs["weightUnit"];
type TempOption = LocalePrefs["temperatureUnit"];

const SYSTEM_OPTIONS: SystemOption[] = ["auto", "metric", "imperialUS"];
// Pace has no `auto` (see `LocalePrefs.paceUnit`): the rowing default is
// per 500 m regardless of the measurement system.
const PACE_OPTIONS: PaceOption[] = ["per500m", "perKm", "perMile"];
const WEIGHT_OPTIONS: WeightOption[] = ["auto", "kg", "lb"];
const TEMP_OPTIONS: TempOption[] = ["auto", "C", "F"];

export default function UnitsPickerScreen() {
  const { t } = useTranslation("settings");
  const { prefs, resolved, setPref } = useLocale();
  const scheme = useColorScheme() ?? "light";
  const tint = TINT[scheme];

  const checkmark = (selected: boolean) =>
    selected ? <IconSymbol name="checkmark" size={20} color={tint} /> : null;

  // The "auto" row previews what would be picked from the OS so users see
  // e.g. "Follow system (metric)" before committing. Other rows just show
  // their static label. We use a parens-friendly inline form ("metric",
  // "imperial US") to avoid nested parentheses inside the outer template.
  const labelFor = (opt: SystemOption): string => {
    if (opt === "auto") {
      return t("units.system.auto", {
        system: t(`units.system.inline.${resolved.auto.measurementSystem}`),
      });
    }
    return t(`units.system.${opt}`);
  };

  return (
    <ThemedView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection header={t("units.system.label")}>
          {SYSTEM_OPTIONS.map((opt) => (
            <SettingsRow
              key={opt}
              label={labelFor(opt)}
              accessory={checkmark(prefs.measurementSystem === opt)}
              onPress={() => setPref("measurementSystem", opt)}
            />
          ))}
        </SettingsSection>

        <SettingsSection
          header={t("units.pace.label")}
          footer={t("units.pace.footer")}
        >
          {PACE_OPTIONS.map((opt) => (
            <SettingsRow
              key={opt}
              label={t(`units.pace.${opt}`)}
              accessory={checkmark(prefs.paceUnit === opt)}
              onPress={() => setPref("paceUnit", opt)}
            />
          ))}
        </SettingsSection>

        <SettingsSection header={t("units.weight.label")}>
          {WEIGHT_OPTIONS.map((opt) => (
            <SettingsRow
              key={opt}
              label={t(`units.weight.${opt}`)}
              accessory={checkmark(prefs.weightUnit === opt)}
              onPress={() => setPref("weightUnit", opt)}
            />
          ))}
        </SettingsSection>

        <SettingsSection header={t("units.temperature.label")}>
          {TEMP_OPTIONS.map((opt) => (
            <SettingsRow
              key={opt}
              label={t(`units.temperature.${opt}`)}
              accessory={checkmark(prefs.temperatureUnit === opt)}
              onPress={() => setPref("temperatureUnit", opt)}
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
