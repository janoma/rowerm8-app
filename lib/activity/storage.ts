/**
 * Activity persistence: FIT bytes on disk + a lightweight summary manifest
 * in AsyncStorage. The manifest is what the History list reads (so it
 * doesn't have to deserialize every FIT file just to show titles), and
 * the FIT files are what the iOS share sheet uploads to Strava etc.
 *
 * All file system calls go through expo-file-system's new SDK 54 class
 * API (`File`/`Directory`/`Paths`); `legacyFileSystem` is intentionally
 * avoided.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import { encodeActivityToFit } from "./fit-writer";
import type { ActivitySummary, RecordedActivity } from "./types";

const MANIFEST_KEY = "rowerm8.activities.manifest.v1";
const ACTIVITIES_DIR_NAME = "activities";

/** A persisted activity: the headline summary plus where the FIT file lives. */
export type StoredActivity = {
  id: string;
  summary: ActivitySummary;
  fitFileUri: string;
};

function activitiesDir(): Directory {
  return new Directory(Paths.document, ACTIVITIES_DIR_NAME);
}

function ensureActivitiesDir(): Directory {
  const dir = activitiesDir();
  if (!dir.exists) {
    // intermediates: true is harmless when the parent already exists, but
    // protects us against a future rename of the parent directory.
    dir.create({ intermediates: true });
  }
  return dir;
}

async function readManifest(): Promise<StoredActivity[]> {
  const raw = await AsyncStorage.getItem(MANIFEST_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // We don't validate every field — if the user upgrades from a future
    // schema, we'd rather render whatever we can than throw and leave
    // them stranded. The history screen will tolerate missing fields.
    return parsed as StoredActivity[];
  } catch {
    return [];
  }
}

async function writeManifest(items: StoredActivity[]): Promise<void> {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(items));
}

/** Returns the manifest, newest-first. */
export async function listActivities(): Promise<StoredActivity[]> {
  return readManifest();
}

/** Look up a single activity by id, or null if it isn't in the manifest. */
export async function getActivity(id: string): Promise<StoredActivity | null> {
  const manifest = await readManifest();
  return manifest.find((a) => a.id === id) ?? null;
}

/**
 * Encode the activity, write the FIT file to the document directory, and
 * prepend a manifest entry. Returns the persisted record so the caller
 * can immediately offer it to a Share Sheet.
 */
export async function saveActivity(
  activity: RecordedActivity,
): Promise<StoredActivity> {
  const fitBytes = encodeActivityToFit(activity);
  const dir = ensureActivitiesDir();
  const file = new File(dir, `${activity.id}.fit`);
  // overwrite: true makes save() idempotent in the rare case the user
  // taps Save twice (e.g. retries after a transient failure).
  file.create({ overwrite: true });
  file.write(fitBytes);

  const stored: StoredActivity = {
    id: activity.id,
    summary: activity.summary,
    fitFileUri: file.uri,
  };
  const manifest = await readManifest();
  // Newest first; this is also the order the History screen renders.
  manifest.unshift(stored);
  await writeManifest(manifest);
  return stored;
}

/** Remove the activity from the manifest and delete its FIT file. */
export async function deleteActivity(id: string): Promise<void> {
  const manifest = await readManifest();
  const idx = manifest.findIndex((a) => a.id === id);
  if (idx === -1) {
    return;
  }
  const stored = manifest[idx];
  try {
    const file = new File(stored.fitFileUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // We still want to remove the manifest entry even if the file is
    // already gone (or unreadable) — otherwise the user is stuck with a
    // ghost row they can't delete.
  }
  manifest.splice(idx, 1);
  await writeManifest(manifest);
}
