/**
 * Android foreground service wrapper for live activity recording.
 *
 * iOS keeps the JS runtime alive in the background via the
 * `bluetooth-central` background mode + connected BLE peripherals (see
 * `app.json`). Android has no equivalent — the OS will throttle JS
 * within seconds of the app going to background unless we hold a
 * foreground service. Notifee's foreground service mechanism gives us
 * exactly that: a persistent notification with a background-task
 * runner whose lifetime is tied to the notification. We don't need
 * the runner to do work; we just need it to stay alive.
 *
 * The foreground service is registered once on app start (idempotent)
 * and started/stopped around the recording lifecycle.
 *
 * iOS / web: every export here is a no-op.
 */
import { Platform } from "react-native";
import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
} from "@notifee/react-native";

const CHANNEL_ID = "rowerm8.recording";
const NOTIFICATION_ID = "rowerm8.recording.fg";

let serviceRegistered = false;
let serviceRunning = false;

/**
 * Register the foreground service runner. Safe to call repeatedly;
 * subsequent calls replace the runner (per Notifee's contract). Should
 * be invoked once at app start so the service is wired up before the
 * first recording.
 */
export function registerRecordingForegroundService(): void {
  if (Platform.OS !== "android") {
    return;
  }
  if (serviceRegistered) {
    return;
  }
  serviceRegistered = true;
  notifee.registerForegroundService(() => {
    // The runner's promise must stay pending for as long as we want
    // the service alive. We resolve it when `stopRecordingForegroundService`
    // calls `stopForegroundService()` — Notifee tears the runner down
    // and the promise gets discarded.
    return new Promise<void>(() => {
      // never resolves on its own
    });
  });
}

async function ensureChannel(): Promise<string> {
  return notifee.createChannel({
    id: CHANNEL_ID,
    name: "Rowing activity",
    description:
      "Notifications shown while a rowing activity is being recorded.",
    importance: AndroidImportance.LOW,
    sound: undefined,
    vibration: false,
  });
}

/**
 * Start the foreground service tied to the recording notification.
 * Must be called from the screen as soon as `handleStart()` runs so
 * the OS doesn't suspend JS the moment the user locks the screen.
 *
 * `title` and `body` are the user-visible strings shown in the
 * notification shade — keep them short and actionable.
 *
 * No-op on iOS / web.
 */
export async function startRecordingForegroundService(opts: {
  title: string;
  body: string;
}): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  registerRecordingForegroundService();
  try {
    await ensureChannel();
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: opts.title,
      body: opts.body,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_HEALTH,
        ],
        // Tap routes back to the app — Expo Router handles the deep
        // link via the registered scheme.
        pressAction: {
          id: "default",
          launchActivity: "default",
        },
        ongoing: true,
        autoCancel: false,
        smallIcon: "ic_notification",
        // Keep the notification compact; LOW importance avoids a
        // sound/heads-up but still pins it in the shade.
        importance: AndroidImportance.LOW,
      },
    });
    serviceRunning = true;
  } catch (e) {
    // Log but don't throw — failing to acquire the foreground service
    // shouldn't kill the recording. The activity will still run while
    // the screen is on; if the user backgrounds the app, JS may stop.
    console.warn("[foreground-service] start failed", e);
  }
}

/**
 * Stop the foreground service. Always call this before clearing the
 * recorder draft so we don't leave a stale "Recording…" notification
 * in the shade after the user has saved or discarded.
 *
 * No-op on iOS / web.
 */
export async function stopRecordingForegroundService(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  if (!serviceRunning) {
    return;
  }
  try {
    await notifee.stopForegroundService();
  } catch (e) {
    console.warn("[foreground-service] stop failed", e);
  } finally {
    serviceRunning = false;
  }
}

/** True while the foreground service notification is live. */
export function isRecordingForegroundServiceRunning(): boolean {
  return serviceRunning;
}
