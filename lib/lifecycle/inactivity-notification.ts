/**
 * Optional opt-in local notification that fires after the inactivity
 * auto-pause threshold while the app isn't in foreground. The user
 * enables this via the Settings → Recording toggle; we additionally
 * gate on a runtime permission check so denying the OS prompt also
 * silently disables the reminder.
 *
 * Notifications are layered on top of the deterministic "auto-pause +
 * auto-save" inactivity policy in the recorder; the app behaves
 * correctly whether or not the user opts in. We only schedule a
 * reminder when AppState is `background`/`inactive` — there's no
 * point notifying about a screen the user is already looking at.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const NOTIFICATION_ID = "rowerm8.inactivity.reminder";
const ANDROID_CHANNEL_ID = "rowerm8.inactivity";

let channelEnsured = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || channelEnsured) {
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Activity reminders",
      description:
        "Reminds you to stop a rowing activity if you've gone inactive.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: undefined,
    });
    channelEnsured = true;
  } catch (e) {
    console.warn("[inactivity-notification] channel setup failed", e);
  }
}

/**
 * Best-effort permission request. Returns true when the OS reports
 * we can post user-facing notifications. Safe to call repeatedly;
 * on iOS it surfaces the system prompt only the first time.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: false,
        allowBadge: false,
      },
    });
    return requested.granted;
  } catch (e) {
    console.warn("[inactivity-notification] permission check failed", e);
    return false;
  }
}

/**
 * Schedule the reminder to fire `delayMs` from now. Cancels any
 * previously-scheduled instance first so we never end up with stale
 * pending notifications. Silently no-ops if the user hasn't granted
 * the OS permission.
 */
export async function scheduleInactivityReminder(opts: {
  delayMs: number;
  title: string;
  body: string;
}): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    return;
  }
  await ensureAndroidChannel();
  await cancelInactivityReminder();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: opts.title,
        body: opts.body,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(opts.delayMs / 1000)),
        ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
  } catch (e) {
    console.warn("[inactivity-notification] schedule failed", e);
  }
}

/** Cancel a previously scheduled reminder. Safe if none exists. */
export async function cancelInactivityReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Ignore — most likely "no scheduled notification with this id".
  }
}
