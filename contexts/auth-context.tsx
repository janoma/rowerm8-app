import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ONBOARDING_FEATURES_SEEN_KEY } from "@/constants/storage-keys";

/**
 * Coarse authentication status.
 *
 * Real sign-in is deferred — `signedIn` is currently unreachable. Wiring it up
 * (probably to Firebase Auth) is a follow-up that adds a real `signIn()`
 * implementation here. Today every cold start lands the user in `guest`.
 */
export type AuthStatus = "loading" | "guest" | "signedIn";

export type AuthUser = {
  /** Stable account id. `null` for guests so callers don't accidentally key telemetry on a placeholder. */
  id: string | null;
  /**
   * Display name shown next to the avatar.
   *
   * `null` for guests — consumers render the localized "Guest Rower" string
   * via `useTranslation("auth")` instead. Real signed-in users carry their
   * own (untranslated) name here.
   */
  displayName: string | null;
  /**
   * 1-3 character avatar initials. `null` for guests; consumers render the
   * localized "GR" via `useTranslation("auth")` (which lets right-to-left
   * locales transliterate the placeholder if they ever choose to).
   */
  initials: string | null;
  /** True when this is the synthetic guest user, not a signed-in account. */
  isGuest: boolean;
};

export type OnboardingStage = "features" | "login";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser;
  /**
   * Whether the onboarding overlay should be visible. Driven by cold-start
   * detection (set on first AuthProvider mount in the JS runtime) and by
   * `openLoginPrompt()` (avatar tap).
   */
  showOnboarding: boolean;
  /**
   * Which sub-screen of the overlay to render. `features` is the first-install
   * 3-slide carousel; `login` is the per-cold-start guest/sign-in block.
   */
  onboardingStage: OnboardingStage;
  /** Has the persisted `featuresSeen` flag been read from AsyncStorage yet? */
  isHydrated: boolean;
  /** Mark the features carousel as seen and advance to the login stage. */
  markFeaturesSeen: () => void;
  /** Confirm guest mode and close the overlay. */
  continueAsGuest: () => void;
  /**
   * Stub for the real sign-in flow. For now it just resolves to "guest";
   * the `OnboardingOverlay` shows the "coming soon" sheet first.
   */
  requestSignIn: () => void;
  /**
   * Manually re-open the overlay at the login stage (used by the Home avatar).
   * Skips the features carousel even if it hasn't been seen — the avatar tap
   * is an explicit "show me the sign-in options" action.
   */
  openLoginPrompt: () => void;
  /** Sign the current user out and re-open the login prompt. */
  signOut: () => void;
};

const GUEST_USER: AuthUser = {
  id: null,
  displayName: null,
  initials: null,
  isGuest: true,
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Module-level "have we already shown the onboarding in this JS session?"
 * guard. This survives React fast-refresh remounts of `AuthProvider`, so dev
 * iteration on the overlay components doesn't re-show the dialog every time.
 *
 * The variable is reset whenever a *new* JS bundle loads — i.e. on a real
 * cold start, which is exactly the trigger we want to use for re-prompting.
 */
let coldStartConsumed = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser>(GUEST_USER);
  const [featuresSeen, setFeaturesSeen] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStage, setOnboardingStage] =
    useState<OnboardingStage>("login");

  // Tracks whether we've already decided to surface the overlay for *this*
  // cold start. Distinct from `coldStartConsumed` which prevents re-triggering
  // across unrelated remounts of the provider.
  const triggeredColdStartRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ONBOARDING_FEATURES_SEEN_KEY)
      .then((raw) => {
        if (cancelled) {
          return;
        }
        const seen = raw === "true";
        setFeaturesSeen(seen);
        // Cold-start trigger: only fire on the very first hydration of the
        // first AuthProvider mount in this JS session. Subsequent mounts
        // (fast refresh, React strict-mode double invoke) are ignored.
        if (!coldStartConsumed && !triggeredColdStartRef.current) {
          coldStartConsumed = true;
          triggeredColdStartRef.current = true;
          setOnboardingStage(seen ? "login" : "features");
          setShowOnboarding(true);
        }
        // Real session hydration (`expo-secure-store`) will go here once we
        // have a backend. Until then, every cold start lands on guest.
        setStatus("guest");
        setUser(GUEST_USER);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        // AsyncStorage failure is non-fatal: assume the carousel has not
        // been seen so the user still gets the onboarding the first time
        // around. Worst case it shows once on a device with broken storage.
        setFeaturesSeen(false);
        if (!coldStartConsumed && !triggeredColdStartRef.current) {
          coldStartConsumed = true;
          triggeredColdStartRef.current = true;
          setOnboardingStage("features");
          setShowOnboarding(true);
        }
        setStatus("guest");
        setUser(GUEST_USER);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markFeaturesSeen = useCallback(() => {
    setFeaturesSeen(true);
    AsyncStorage.setItem(ONBOARDING_FEATURES_SEEN_KEY, "true").catch(() => {
      // Best-effort persistence; in-memory state still flips so the user
      // doesn't see the carousel a second time within this session.
    });
    setOnboardingStage("login");
  }, []);

  const continueAsGuest = useCallback(() => {
    setStatus("guest");
    setUser(GUEST_USER);
    setShowOnboarding(false);
  }, []);

  const requestSignIn = useCallback(() => {
    // Real implementation lands once the backend is picked. For now this is
    // a no-op so callers can wire up the action; `OnboardingOverlay` shows a
    // "coming soon" sheet on the same press.
  }, []);

  const openLoginPrompt = useCallback(() => {
    setOnboardingStage("login");
    setShowOnboarding(true);
  }, []);

  const signOut = useCallback(() => {
    // No real session to clear yet. Once we have one, drop the secure-store
    // token here, then drop server-side state via the auth SDK.
    setStatus("guest");
    setUser(GUEST_USER);
    setOnboardingStage("login");
    setShowOnboarding(true);
  }, []);

  const isHydrated = featuresSeen !== null;

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      showOnboarding,
      onboardingStage,
      isHydrated,
      markFeaturesSeen,
      continueAsGuest,
      requestSignIn,
      openLoginPrompt,
      signOut,
    }),
    [
      status,
      user,
      showOnboarding,
      onboardingStage,
      isHydrated,
      markFeaturesSeen,
      continueAsGuest,
      requestSignIn,
      openLoginPrompt,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
