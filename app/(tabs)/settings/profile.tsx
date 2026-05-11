import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLocale } from "@/contexts/locale-context";
import {
  type HrZoneModel,
  PROFILE_DEFAULTS,
  PROFILE_LIMITS,
  type ProfilePrefs,
  type Sex,
  useProfile,
} from "@/contexts/profile-context";
import { Button, Sheet, useTheme } from "@/lib/design-system";
import { ENABLE_COGGAN_HR_ZONE_MODEL } from "@/lib/feature-flags";
import { kilogramsToPounds, poundsToKilograms } from "@/lib/units";

/**
 * Heart-rate & body-metrics editor. Each row opens a small bottom
 * sheet with a number input (or, for sex, an enum picker), a "Use
 * default" shortcut that resets the field to `null`, and a Save
 * action that validates the input against the field's plausible
 * range. Values are persisted via `useProfile().setPref` and the
 * defaults shown in the row subtitles come from the same resolver
 * used by the rest of the app.
 *
 * The "Heart rate zones" section and the "Threshold heart rate" row
 * are gated behind {@link ENABLE_COGGAN_HR_ZONE_MODEL} — see that
 * flag's docstring for the why and the steps to flip it back on.
 */
export default function ProfileScreen() {
  const { t } = useTranslation("settings");
  const { resolved: locale } = useLocale();
  const { prefs, resolved, setPref, resetPrefs } = useProfile();
  const { tokens } = useTheme();

  const [editingField, setEditingField] = useState<
    NumericField | "sex" | "hrZoneModel" | null
  >(null);

  const closeSheet = () => setEditingField(null);

  const numericFields = useNumericFields(locale.weightUnit);

  const handleReset = () => {
    Alert.alert(
      t("profile.reset.alert.title"),
      t("profile.reset.alert.message"),
      [
        { text: t("profile.input.cancel"), style: "cancel" },
        {
          text: t("profile.reset.alert.confirm"),
          style: "destructive",
          onPress: resetPrefs,
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {ENABLE_COGGAN_HR_ZONE_MODEL ? (
          <SettingsSection
            header={t("profile.section.zoneModel")}
            footer={t("profile.section.zoneModelFooter")}
          >
            <SettingsRow
              label={t(
                `profile.fields.hrZoneModel.options.${resolved.hrZoneModel}.label`,
              )}
              subtitle={t(
                `profile.fields.hrZoneModel.options.${resolved.hrZoneModel}.subtitle`,
              )}
              onPress={() => setEditingField("hrZoneModel")}
            />
          </SettingsSection>
        ) : null}

        <SettingsSection
          header={t("profile.section.heartRate")}
          footer={t("profile.section.heartRateFooter")}
        >
          <SettingsRow
            label={t("profile.fields.maxHrBpm.label")}
            subtitle={describeNumber(t, "maxHrBpm", prefs.maxHrBpm, {
              defaultValue: PROFILE_DEFAULTS.maxHrBpm,
            })}
            onPress={() => setEditingField("maxHrBpm")}
          />
          {ENABLE_COGGAN_HR_ZONE_MODEL ? (
            <SettingsRow
              label={t("profile.fields.thresholdHrBpm.label")}
              subtitle={describeNumber(
                t,
                "thresholdHrBpm",
                prefs.thresholdHrBpm,
                {
                  defaultValue: resolved.thresholdHrBpm,
                },
              )}
              onPress={() => setEditingField("thresholdHrBpm")}
            />
          ) : null}
        </SettingsSection>

        <SettingsSection
          header={t("profile.section.body")}
          footer={t("profile.section.bodyFooter")}
        >
          <SettingsRow
            label={t("profile.fields.weightKg.label")}
            subtitle={describeWeight(t, prefs.weightKg, locale.weightUnit)}
            onPress={() => setEditingField("weightKg")}
          />
          <SettingsRow
            label={t("profile.fields.ageYears.label")}
            subtitle={describeNumber(t, "ageYears", prefs.ageYears, {
              defaultValue: PROFILE_DEFAULTS.ageYears,
            })}
            onPress={() => setEditingField("ageYears")}
          />
          <SettingsRow
            label={t("profile.fields.sex.label")}
            subtitle={describeSex(t, prefs.sex)}
            onPress={() => setEditingField("sex")}
          />
        </SettingsSection>

        <SettingsSection footer={t("profile.footer")}>
          <SettingsRow
            label={t("profile.reset.label")}
            subtitle={t("profile.reset.subtitle")}
            destructive
            onPress={handleReset}
          />
        </SettingsSection>
      </ScrollView>

      {editingField &&
      editingField !== "sex" &&
      editingField !== "hrZoneModel" ? (
        <NumericFieldSheet
          field={editingField}
          spec={numericFields[editingField]}
          prefs={prefs}
          setPref={setPref}
          onClose={closeSheet}
        />
      ) : null}

      {editingField === "sex" ? (
        <SexFieldSheet
          value={prefs.sex}
          onClose={closeSheet}
          onSelect={(next) => {
            setPref("sex", next);
            closeSheet();
          }}
          accentColor={tokens.colors.accent}
        />
      ) : null}

      {ENABLE_COGGAN_HR_ZONE_MODEL && editingField === "hrZoneModel" ? (
        <HrZoneModelSheet
          value={prefs.hrZoneModel}
          onClose={closeSheet}
          onSelect={(next) => {
            setPref("hrZoneModel", next);
            closeSheet();
          }}
          accentColor={tokens.colors.accent}
        />
      ) : null}
    </ThemedView>
  );
}

type NumericField = "maxHrBpm" | "thresholdHrBpm" | "weightKg" | "ageYears";

type NumericFieldSpec = {
  /** Min allowed value in the *displayed* unit. */
  min: number;
  /** Max allowed value in the *displayed* unit. */
  max: number;
  /** Convert a value coming back from the input field into the storage unit (`kg`, `bpm`, `yrs`). */
  toStorage(displayed: number): number;
  /** Convert a stored value into the display unit (e.g. kg → lb when needed). */
  fromStorage(stored: number): number;
  /** Translation prefix under `profile.fields.<key>`. */
  i18nKey: NumericField;
  /** Documented default in the storage unit (used by the picker footer). */
  defaultStored: number;
  /** Single-line unit suffix (e.g. ` bpm`, ` kg`). */
  unitSuffix: string;
};

function useNumericFields(
  weightUnit: "kg" | "lb",
): Record<NumericField, NumericFieldSpec> {
  return useMemo(
    () => ({
      maxHrBpm: {
        min: PROFILE_LIMITS.maxHrBpm.min,
        max: PROFILE_LIMITS.maxHrBpm.max,
        toStorage: (v) => Math.round(v),
        fromStorage: (v) => Math.round(v),
        i18nKey: "maxHrBpm",
        defaultStored: PROFILE_DEFAULTS.maxHrBpm,
        unitSuffix: " bpm",
      },
      thresholdHrBpm: {
        min: PROFILE_LIMITS.thresholdHrBpm.min,
        max: PROFILE_LIMITS.thresholdHrBpm.max,
        toStorage: (v) => Math.round(v),
        fromStorage: (v) => Math.round(v),
        i18nKey: "thresholdHrBpm",
        defaultStored: Math.round(
          PROFILE_DEFAULTS.maxHrBpm * PROFILE_DEFAULTS.thresholdFractionOfMax,
        ),
        unitSuffix: " bpm",
      },
      weightKg:
        weightUnit === "kg"
          ? {
              min: PROFILE_LIMITS.weightKg.min,
              max: PROFILE_LIMITS.weightKg.max,
              toStorage: (v) => v,
              fromStorage: (v) => v,
              i18nKey: "weightKg",
              defaultStored: PROFILE_DEFAULTS.weightKg,
              unitSuffix: " kg",
            }
          : {
              min: Math.round(kilogramsToPounds(PROFILE_LIMITS.weightKg.min)),
              max: Math.round(kilogramsToPounds(PROFILE_LIMITS.weightKg.max)),
              toStorage: (lb) => poundsToKilograms(lb),
              fromStorage: (kg) => kilogramsToPounds(kg),
              i18nKey: "weightKg",
              defaultStored: PROFILE_DEFAULTS.weightKg,
              unitSuffix: " lb",
            },
      ageYears: {
        min: PROFILE_LIMITS.ageYears.min,
        max: PROFILE_LIMITS.ageYears.max,
        toStorage: (v) => Math.round(v),
        fromStorage: (v) => Math.round(v),
        i18nKey: "ageYears",
        defaultStored: PROFILE_DEFAULTS.ageYears,
        unitSuffix: " yrs",
      },
    }),
    [weightUnit],
  );
}

function NumericFieldSheet({
  field,
  spec,
  prefs,
  setPref,
  onClose,
}: {
  field: NumericField;
  spec: NumericFieldSpec;
  prefs: ProfilePrefs;
  setPref: <K extends keyof ProfilePrefs>(
    key: K,
    value: ProfilePrefs[K],
  ) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("settings");
  const { tokens } = useTheme();
  const initialDisplayed =
    prefs[field] != null
      ? Math.round(spec.fromStorage(prefs[field] as number)).toString()
      : "";
  const [draft, setDraft] = useState(initialDisplayed);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    Keyboard.dismiss();
    const trimmed = draft.trim();
    if (trimmed === "") {
      setPref(field, null);
      onClose();
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < spec.min || parsed > spec.max) {
      setError(t("profile.input.outOfRange", { min: spec.min, max: spec.max }));
      return;
    }
    setPref(field, spec.toStorage(parsed));
    onClose();
  };

  const clear = () => {
    setPref(field, null);
    onClose();
  };

  const i18nPath = `profile.fields.${spec.i18nKey}` as const;

  return (
    <Sheet visible onClose={onClose} title={t(`${i18nPath}.pickerTitle`)}>
      <ThemedText
        style={[styles.sheetFooter, { color: tokens.colors.textSecondary }]}
      >
        {t(`${i18nPath}.pickerFooter`, {
          default: Math.round(spec.fromStorage(spec.defaultStored)),
          unit: spec.unitSuffix,
        })}
      </ThemedText>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
            borderRadius: tokens.radius.md,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: tokens.colors.text }]}
          keyboardType="numeric"
          autoFocus
          value={draft}
          onChangeText={(next) => {
            setError(null);
            setDraft(next);
          }}
          onSubmitEditing={commit}
          returnKeyType="done"
          placeholderTextColor={tokens.colors.textSecondary}
          placeholder={Math.round(
            spec.fromStorage(spec.defaultStored),
          ).toString()}
        />
        <ThemedText style={{ color: tokens.colors.textSecondary }}>
          {spec.unitSuffix.trim()}
        </ThemedText>
      </View>
      {error ? (
        <ThemedText style={{ color: tokens.colors.danger }}>{error}</ThemedText>
      ) : null}
      <View style={styles.sheetActions}>
        <View style={styles.sheetActionFlex}>
          <Button
            title={t("profile.input.useDefault")}
            onPress={clear}
            tone="neutral"
            variant="tinted"
            size="lg"
            block
          />
        </View>
        <View style={styles.sheetActionFlex}>
          <Button
            title={t("profile.input.save")}
            onPress={commit}
            tone="accent"
            variant="filled"
            size="lg"
            block
          />
        </View>
      </View>
    </Sheet>
  );
}

function HrZoneModelSheet({
  value,
  onSelect,
  onClose,
  accentColor,
}: {
  value: HrZoneModel | null;
  onSelect: (next: HrZoneModel | null) => void;
  onClose: () => void;
  accentColor: string;
}) {
  const { t } = useTranslation("settings");
  const options: HrZoneModel[] = ["garminPolar5", "cogganFriel7"];
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t("profile.fields.hrZoneModel.pickerTitle")}
    >
      {options.map((opt) => (
        <SettingsRow
          key={opt}
          label={t(`profile.fields.hrZoneModel.options.${opt}.label`)}
          subtitle={t(`profile.fields.hrZoneModel.options.${opt}.subtitle`)}
          accessory={
            value === opt ? (
              <IconSymbol name="checkmark" size={20} color={accentColor} />
            ) : null
          }
          onPress={() => onSelect(opt)}
        />
      ))}
      <SettingsRow
        label={t("profile.input.useDefault")}
        subtitle={t("profile.fields.hrZoneModel.useDefaultSubtitle", {
          value: t(
            `profile.fields.hrZoneModel.options.${PROFILE_DEFAULTS.hrZoneModel}.label`,
          ),
        })}
        accessory={
          value == null ? (
            <IconSymbol name="checkmark" size={20} color={accentColor} />
          ) : null
        }
        onPress={() => onSelect(null)}
      />
    </Sheet>
  );
}

function SexFieldSheet({
  value,
  onSelect,
  onClose,
  accentColor,
}: {
  value: Sex | null;
  onSelect: (next: Sex | null) => void;
  onClose: () => void;
  accentColor: string;
}) {
  const { t } = useTranslation("settings");
  const options: Sex[] = ["male", "female"];
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t("profile.fields.sex.pickerTitle")}
    >
      {options.map((opt) => (
        <SettingsRow
          key={opt}
          label={t(`profile.fields.sex.options.${opt}`)}
          accessory={
            value === opt ? (
              <IconSymbol name="checkmark" size={20} color={accentColor} />
            ) : null
          }
          onPress={() => onSelect(opt)}
        />
      ))}
      <SettingsRow
        label={t("profile.input.useDefault")}
        accessory={
          value == null ? (
            <IconSymbol name="checkmark" size={20} color={accentColor} />
          ) : null
        }
        onPress={() => onSelect(null)}
      />
    </Sheet>
  );
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function describeNumber(
  t: TFn,
  field: NumericField,
  raw: number | null,
  { defaultValue }: { defaultValue: number },
): string {
  const i18nPath = `profile.fields.${field}`;
  if (raw == null) {
    return t(`${i18nPath}.subtitleDefault`, { value: defaultValue });
  }
  return t(`${i18nPath}.subtitleValue`, { value: Math.round(raw) });
}

function describeWeight(
  t: TFn,
  rawKg: number | null,
  weightUnit: "kg" | "lb",
): string {
  const unit =
    weightUnit === "kg"
      ? t("profile.fields.weightKg.unitKg")
      : t("profile.fields.weightKg.unitLb");
  if (rawKg == null) {
    const displayed =
      weightUnit === "kg"
        ? PROFILE_DEFAULTS.weightKg
        : Math.round(kilogramsToPounds(PROFILE_DEFAULTS.weightKg));
    return t("profile.fields.weightKg.subtitleDefault", {
      value: displayed,
      unit,
    });
  }
  const displayed =
    weightUnit === "kg"
      ? Math.round(rawKg)
      : Math.round(kilogramsToPounds(rawKg));
  return t("profile.fields.weightKg.subtitleValue", {
    value: displayed,
    unit,
  });
}

function describeSex(t: TFn, raw: Sex | null): string {
  if (raw == null) {
    return t("profile.fields.sex.subtitleDefault", {
      value: t(`profile.fields.sex.options.${PROFILE_DEFAULTS.sex}`),
    });
  }
  return t("profile.fields.sex.subtitleValue", {
    value: t(`profile.fields.sex.options.${raw}`),
  });
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
  sheetFooter: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: "600",
    paddingVertical: 4,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 4,
  },
  sheetActionFlex: {
    flex: 1,
  },
});
