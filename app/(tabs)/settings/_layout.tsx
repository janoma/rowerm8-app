import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function SettingsLayout() {
  const { t } = useTranslation("settings");

  return (
    <Stack>
      {/* The index screen hides its own header (the screen renders a custom
          title), but we still set `title` so the back button on pushed
          screens reads "Settings" instead of the file name "index". */}
      <Stack.Screen
        name="index"
        options={{ headerShown: false, title: t("title") }}
      />
      <Stack.Screen
        name="appearance"
        options={{ title: t("sections.appearance") }}
      />
      <Stack.Screen
        name="language"
        options={{ title: t("sections.language") }}
      />
      <Stack.Screen name="units" options={{ title: t("sections.units") }} />
    </Stack>
  );
}
