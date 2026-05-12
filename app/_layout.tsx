import { ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
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
  mostRecentDraft,
  pruneStaleDrafts,
  RESUME_WINDOW_MS,
} from "@/lib/activity/draft";
import {
  ThemeProvider,
  buildNavigationTheme,
  useTheme,
} from "@/lib/design-system";
import { registerRecordingForegroundService } from "@/lib/lifecycle/foreground-service";

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Cold-start recovery for in-flight activities.
 *
 * If the user force-closed (or the OS killed) the app while a
 * recording was live, we still have a draft on disk. On the very
 * first mount of the root layout we sweep stale drafts, then if a
 * fresh one remains we deep-link to /free-row?recover=<id> so the
 * Free Row screen can surface the Resume / Save / Discard prompt.
 *
 * The draft is kept on disk across the prompt — discarding here only
 * affects state inside the screen. The screen owns deletion via its
 * `handleRecoveryDiscard` flow.
 */
function useDraftRecoveryBoot(): void {
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) {
      return;
    }
    ranRef.current = true;
    try {
      const now = Date.now();
      pruneStaleDrafts(now);
      const draft = mostRecentDraft();
      if (!draft) {
        return;
      }
      // Drafts older than the resume window still surface — the
      // screen will hide the Resume button and only offer Save /
      // Discard. The hard-TTL sweep above already removed anything
      // truly ancient (> 7 days).
      if (now - draft.lastEventAtMs > RESUME_WINDOW_MS * 24 * 7) {
        return;
      }
      router.push({
        pathname: "/free-row",
        params: { recover: draft.id },
      });
    } catch (e) {
      console.warn("[layout] draft recovery check failed", e);
    }
  }, []);
}

/**
 * Inner layout: consumes the design-system theme and bridges it into
 * `@react-navigation/native`'s ThemeProvider so transitions, headers,
 * and tab bars share the same surface/text/accent colors.
 */
function ThemedRootLayout() {
  const { scheme, tokens } = useTheme();
  const navigationTheme = buildNavigationTheme(scheme, tokens);

  useDraftRecoveryBoot();
  useEffect(() => {
    // Register the Notifee foreground-service runner once at boot. The
    // service itself doesn't start until a recording does, but the
    // runner has to be registered synchronously during JS startup so
    // notifee can resume an existing service after a JS reload.
    registerRecordingForegroundService();
  }, []);

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
