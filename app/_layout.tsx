import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import "react-native-reanimated";

import { BleProvider } from "@/contexts/ble-context";
import { LocaleProvider } from "@/contexts/locale-context";
import { MotionSensorProvider } from "@/contexts/motion-sensor-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LocaleProvider>
        <MotionSensorProvider>
          <BleProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal"
                  options={{ presentation: "modal", title: "Modal" }}
                />
                <Stack.Screen
                  name="ble-scan"
                  options={{
                    presentation: "fullScreenModal",
                    headerShown: false,
                  }}
                />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </BleProvider>
        </MotionSensorProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
