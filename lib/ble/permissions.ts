import { PermissionsAndroid, Platform } from "react-native";

/**
 * Result of a runtime BLE permission request.
 *
 *   - `granted` — every required permission was granted; safe to start
 *     scanning / connecting.
 *   - `denied`  — the user declined at least one prompt this session.
 *   - `blocked` — at least one permission is set to "Don't ask again" or is
 *     `RESTRICTED` (parental controls, MDM, etc.). Surface a "Open Settings"
 *     affordance to recover.
 *   - `notRequired` — current platform does not gate BLE behind runtime
 *     prompts (iOS handles this natively when `BleManager` is created).
 */
export type BlePermissionStatus =
  | "granted"
  | "denied"
  | "blocked"
  | "notRequired";

const ANDROID_12 = 31;

/**
 * Request the Android runtime permissions needed by `react-native-ble-plx`
 * to scan for and connect to peripherals. Android 12+ requires the new
 * `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` runtime permissions; earlier
 * versions piggyback on `ACCESS_FINE_LOCATION` because BLE scan results
 * could be used to triangulate location.
 *
 * The iOS prompt is triggered separately by the first instantiation of
 * `BleManager` — this helper is a no-op there.
 *
 * Safe to call repeatedly: `requestMultiple` returns `"granted"` for
 * already-granted permissions without re-prompting the user.
 */
export async function requestBlePermissions(): Promise<BlePermissionStatus> {
  if (Platform.OS !== "android") {
    return "notRequired";
  }

  // `Platform.Version` is `number` on Android — `string` would mean we're
  // running on web and wouldn't have hit this branch.
  const version =
    typeof Platform.Version === "number"
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);

  // Build the required-permissions list once; it's small and lets us hand a
  // single payload to `requestMultiple`.
  const required: string[] =
    version >= ANDROID_12
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  try {
    const result = await PermissionsAndroid.requestMultiple(
      required as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
    );
    let allGranted = true;
    let anyBlocked = false;
    for (const perm of required) {
      const status = result[perm as keyof typeof result];
      if (status === PermissionsAndroid.RESULTS.GRANTED) {
        continue;
      }
      allGranted = false;
      if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        anyBlocked = true;
      }
    }
    if (allGranted) {
      return "granted";
    }
    return anyBlocked ? "blocked" : "denied";
  } catch {
    // The native module can throw if the host activity is in a weird state
    // (e.g. backgrounded mid-prompt); treat that as a soft denial so the
    // caller surfaces a banner rather than crashing the screen.
    return "denied";
  }
}
