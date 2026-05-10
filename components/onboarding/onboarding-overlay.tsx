import { useCallback, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/lib/design-system";

import { FeaturesCarousel } from "./features-carousel";
import { LoginBlock } from "./login-block";
import { SignInComingSoonSheet } from "./sign-in-coming-soon-sheet";

/**
 * Root-level orchestrator for the install / cold-start onboarding flow.
 *
 * Reads `showOnboarding` and `onboardingStage` from `AuthProvider` and
 * surfaces the right sub-screen on top of the entire app:
 *
 *   1. `features` — the first-install 3-slide carousel. Dismissing flips
 *      stage to `login` (handled inside the auth context).
 *   2. `login`    — the welcome / guest / sign-in surface, replayed on
 *      every cold start until the user signs in.
 *
 * The overlay is intentionally non-dismissible by hardware back or scrim
 * tap (we render no scrim — it's a full-screen takeover). The only exits
 * are the explicit CTAs handled by the auth context.
 */
export function OnboardingOverlay() {
  const { tokens } = useTheme();
  const {
    showOnboarding,
    onboardingStage,
    isHydrated,
    markFeaturesSeen,
    continueAsGuest,
  } = useAuth();
  const [comingSoonVisible, setComingSoonVisible] = useState(false);

  const handleSignIn = useCallback(() => {
    setComingSoonVisible(true);
  }, []);

  const handleComingSoonDismiss = useCallback(() => {
    setComingSoonVisible(false);
    // Until real sign-in lands, "Sign in" simply funnels users into the
    // guest experience after acknowledging the dialog. When auth is wired
    // up, the post-dismiss action moves to the actual sign-in flow.
    continueAsGuest();
  }, [continueAsGuest]);

  if (!isHydrated || !showOnboarding) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="fade"
      // Using `transparent={false}` so the overlay paints the full surface
      // background and the user never glimpses the underlying tab bar
      // during the fade-in. The carousel + login block both render their
      // own SafeAreaView so insets stay correct across both stages.
      transparent={false}
      // No dismissable hardware-back: returning false swallows the event.
      onRequestClose={() => undefined}
      statusBarTranslucent
    >
      {/*
       * Mount a fresh `SafeAreaProvider` inside the Modal. iOS hosts the
       * Modal contents in a separate UIWindow, which detaches the React
       * tree from the root `SafeAreaProvider` and leaves the inset values
       * at 0 until something forces a relayout — which is what was making
       * the carousel's "Skip" button drift under the status bar on the
       * first two slides and "fix itself" only after navigating to the
       * third slide and back. Re-rooting the provider here re-measures
       * insets against the Modal's own window.
       */}
      <SafeAreaProvider>
        <View style={[styles.root, { backgroundColor: tokens.colors.surface }]}>
          {onboardingStage === "features" ? (
            <FeaturesCarousel onComplete={markFeaturesSeen} />
          ) : (
            <LoginBlock
              onContinueAsGuest={continueAsGuest}
              onSignIn={handleSignIn}
            />
          )}
        </View>
        <SignInComingSoonSheet
          visible={comingSoonVisible}
          onDismiss={handleComingSoonDismiss}
        />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
