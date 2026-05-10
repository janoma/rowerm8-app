import { ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import "react-native-reanimated";

import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { AuthProvider } from "@/contexts/auth-context";
import { BleProvider } from "@/contexts/ble-context";
import { HeartRateProvider } from "@/contexts/heart-rate-context";
import { LocaleProvider } from "@/contexts/locale-context";
import { MotionSensorProvider } from "@/contexts/motion-sensor-context";
import { ProfileProvider } from "@/contexts/profile-context";
import {
  ThemeProvider,
  buildNavigationTheme,
  useTheme,
} from "@/lib/design-system";

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Inner layout: consumes the design-system theme and bridges it into
 * `@react-navigation/native`'s ThemeProvider so transitions, headers,
 * and tab bars share the same surface/text/accent colors.
 */
function ThemedRootLayout() {
  const { scheme, tokens } = useTheme();
  const navigationTheme = buildNavigationTheme(scheme, tokens);

  return (
    <NavThemeProvider value={navigationTheme}>
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
        <Stack.Screen name="free-row" options={{ headerShown: false }} />
        <Stack.Screen name="activity/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="design-system"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
      </Stack>
      {/*
       * Mounted as a sibling of the navigator so the onboarding overlay
       * paints above every tab + stack screen on cold start (and again
       * when the user taps the Home avatar). The overlay uses a
       * non-transparent <Modal> internally and self-hides when there's
       * nothing to show.
       */}
      <OnboardingOverlay />
      <StatusBar style="auto" />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <LocaleProvider>
          <ProfileProvider>
            <AuthProvider>
              <MotionSensorProvider>
                <HeartRateProvider>
                  <BleProvider>
                    <ThemedRootLayout />
                  </BleProvider>
                </HeartRateProvider>
              </MotionSensorProvider>
            </AuthProvider>
          </ProfileProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
