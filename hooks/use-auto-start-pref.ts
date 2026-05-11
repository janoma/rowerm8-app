import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { AUTO_START_DISABLED_KEY } from "@/constants/storage-keys";

type UseAutoStartPref = {
  /**
   * `true` when auto-start is enabled (the modal will arm on the first
   * detected stroke), `false` when the user has explicitly disabled it
   * in Settings, and `null` while we hydrate the preference from
   * AsyncStorage. Consumers should treat `null` as "not yet known"
   * (don't auto-start, but also don't render the toggle as off).
   */
  enabled: boolean | null;
  /** Persists the next value and updates local state immediately. */
  setEnabled: (next: boolean) => void;
};

/**
 * Reads + persists the Free-row auto-start preference. The hook is a
 * thin wrapper around `AsyncStorage` keyed on `AUTO_START_DISABLED_KEY`
 * (note the inverted form: missing key === auto-start ENABLED, mirrors
 * the existing welcome-slides / placement-instructions toggles).
 *
 * Each consumer instance hydrates independently. That's fine here
 * because the two known consumers — Free row screen and the Settings
 * tab — are never visible at the same time on a phone (Settings lives
 * in a different tab; entering Free row mounts a new component with a
 * fresh hydration). Adding a context for cross-screen sync would be
 * over-engineering for the current scope.
 */
export function useAutoStartPref(): UseAutoStartPref {
  const [enabled, setEnabledState] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(AUTO_START_DISABLED_KEY)
      .then((v) => {
        if (cancelled) {
          return;
        }
        setEnabledState(v !== "true");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        // Treat a storage failure as "default on" so the user still
        // sees the documented behavior (auto-start armed by default).
        setEnabledState(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    const op = next
      ? AsyncStorage.removeItem(AUTO_START_DISABLED_KEY)
      : AsyncStorage.setItem(AUTO_START_DISABLED_KEY, "true");
    op.catch(() => {});
  }, []);

  return { enabled, setEnabled };
}
