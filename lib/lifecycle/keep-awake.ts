/**
 * Thin wrapper around `expo-keep-awake` that scopes activation to a
 * single shared tag, so callers don't have to coordinate or string
 * tags themselves. Use {@link useRecordingKeepAwake} from the Free Row
 * screen to keep the screen on while a recording is in flight.
 */
import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

const KEEP_AWAKE_TAG = "rowerm8.recording";

/**
 * Keep the device's screen on while `active` is true. Cleans up on
 * unmount or when `active` flips to false. Safe to call many times in
 * a row — `expo-keep-awake` reference-counts internally.
 *
 * Use this from screens that record an activity. The display is
 * allowed to dim/sleep again as soon as the session ends.
 */
export function useRecordingKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((e) => {
      if (cancelled) {
        return;
      }
      // Failing to acquire the wake lock isn't recoverable, but it's
      // also not catastrophic — the user can dim the screen manually.
      console.warn("[keep-awake] activation failed", e);
    });
    return () => {
      cancelled = true;
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // Best-effort.
      }
    };
  }, [active]);
}
