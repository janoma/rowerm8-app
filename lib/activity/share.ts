/**
 * Share helper: open the system share sheet for a saved FIT file. Strava,
 * TrainingPeaks, Garmin Connect, and Apple Fitness all accept FIT
 * uploads from the share sheet on iOS / Android.
 *
 * Kept separate from `storage.ts` so the storage layer stays usable in
 * tests/headless environments without dragging the native share module.
 */
import * as Sharing from "expo-sharing";

/** UTI for FIT files on iOS; Garmin's manufacturer-registered identifier. */
const FIT_UTI = "com.garmin.fit";
const FIT_MIME = "application/vnd.ant.fit";

export type ShareResult = "shared" | "unavailable";

/**
 * Open the share sheet for the given FIT file URI.
 *
 * Returns "unavailable" if the platform doesn't support the share sheet
 * (e.g. web in some browsers); the caller should fall back to a less
 * graceful UX (alert, etc.) rather than crash.
 */
export async function shareFitFile(
  fitFileUri: string,
  dialogTitle: string,
): Promise<ShareResult> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    return "unavailable";
  }
  await Sharing.shareAsync(fitFileUri, {
    dialogTitle,
    mimeType: FIT_MIME,
    UTI: FIT_UTI,
  });
  return "shared";
}
