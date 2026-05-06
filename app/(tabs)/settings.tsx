import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { PLACEMENT_DONT_SHOW_KEY } from "@/constants/storage-keys";

export default function SettingsScreen() {
  const handleResetPlacement = () => {
    Alert.alert(
      "Reset placement instructions",
      "The sensor placement guide will be shown again the next time you select a sensor.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            AsyncStorage.removeItem(PLACEMENT_DONT_SHOW_KEY).catch(() => {});
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.title}>
            Settings
          </ThemedText>

          <View style={styles.sections}>
            <SettingsSection
              header="Help"
              footer="Restores dialogs you've previously dismissed with 'Don't show again'."
            >
              <SettingsRow
                label="Reset placement instructions"
                subtitle="Show the sensor placement guide on next selection"
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
