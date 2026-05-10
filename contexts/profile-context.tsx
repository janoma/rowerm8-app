/**
 * React glue around the pure profile resolver in
 * {@link "@/lib/profile/resolver"}. The resolver holds the schema,
 * defaults, and migration logic so it can be unit-tested in plain
 * Node; this file binds it to AsyncStorage + React state and exposes
 * the `useProfile()` hook used throughout the app.
 *
 * Mirrors the shape of `locale-context.tsx`: best-effort hydration on
 * mount, in-memory updates first, AsyncStorage write fire-and-forget.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { PROFILE_PREFS_KEY } from "@/constants/storage-keys";
import {
  DEFAULT_PREFS,
  migrateProfilePrefs,
  type ProfilePrefs,
  type ResolvedProfile,
  resolveProfile,
} from "@/lib/profile/resolver";

export type ProfileContextValue = {
  prefs: ProfilePrefs;
  resolved: ResolvedProfile;
  isHydrated: boolean;
  setPref: <K extends keyof ProfilePrefs>(
    key: K,
    value: ProfilePrefs[K],
  ) => void;
  resetPrefs: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<ProfilePrefs>(DEFAULT_PREFS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PROFILE_PREFS_KEY)
      .then((raw) => {
        if (cancelled || !raw) {
          return;
        }
        try {
          const parsed = JSON.parse(raw) as Partial<ProfilePrefs>;
          setPrefs((prev) => ({ ...prev, ...migrateProfilePrefs(parsed) }));
        } catch {
          // Corrupt entry — defaults are usable.
        }
      })
      .catch(() => {
        // AsyncStorage failure is non-fatal.
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useMemo<ResolvedProfile>(
    () => resolveProfile(prefs),
    [prefs],
  );

  const setPref = useCallback(
    <K extends keyof ProfilePrefs>(key: K, value: ProfilePrefs[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(PROFILE_PREFS_KEY, JSON.stringify(next)).catch(
          () => {
            // Best-effort persistence; in-memory state still updates.
          },
        );
        return next;
      });
    },
    [],
  );

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    AsyncStorage.removeItem(PROFILE_PREFS_KEY).catch(() => {});
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({ prefs, resolved, isHydrated, setPref, resetPrefs }),
    [prefs, resolved, isHydrated, setPref, resetPrefs],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}

// Re-export the resolver public surface so consumers can keep
// importing types and constants from a single module.
export type {
  ProfilePrefs,
  ResolvedProfile,
  Sex,
} from "@/lib/profile/resolver";
export {
  DEFAULT_PREFS,
  PROFILE_DEFAULTS,
  PROFILE_LIMITS,
  resolveProfile,
} from "@/lib/profile/resolver";
