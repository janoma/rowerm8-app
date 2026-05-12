import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { INACTIVITY_REMINDER_ENABLED_KEY } from "@/constants/storage-keys";

type UseInactivityReminderPref = {
  /**
   * `true` when the user has opted in to the "Are you still rowing?"
   * reminder, `false` when the toggle is off (default), `null` while
   * the preference is being hydrated. Consumers should treat `null`
   * as "not yet known" and behave as if the toggle is off.
   */
  enabled: boolean | null;
  setEnabled: (next: boolean) => void;
};

/**
 * Reads + persists the opt-in inactivity-reminder toggle. Stored in
 * "enabled" form (missing key === off) because notifications are
 * opt-in and we don't want to schedule them by default — most users
 * haven't granted the OS notification permission yet.
 */
export function useInactivityReminderPref(): UseInactivityReminderPref {
  const [enabled, setEnabledState] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(INACTIVITY_REMINDER_ENABLED_KEY)
      .then((v) => {
        if (cancelled) {
          return;
        }
        setEnabledState(v === "true");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setEnabledState(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    const op = next
      ? AsyncStorage.setItem(INACTIVITY_REMINDER_ENABLED_KEY, "true")
      : AsyncStorage.removeItem(INACTIVITY_REMINDER_ENABLED_KEY);
    op.catch(() => {});
  }, []);

  return { enabled, setEnabled };
}
