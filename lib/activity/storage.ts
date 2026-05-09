/**
 * Activity persistence: FIT bytes on disk + a lightweight summary manifest
 * in AsyncStorage. The manifest is what the History list reads (so it
 * doesn't have to deserialize every FIT file just to show titles), and
 * the FIT files are what the iOS share sheet uploads to Strava etc.
 *
 * All file system calls go through expo-file-system's new SDK 54 class
 * API (`File`/`Directory`/`Paths`); `legacyFileSystem` is intentionally
 * avoided.
 *
 * URI stability across reinstalls
 *   iOS embeds a data-container UUID inside `Paths.document` (the
 *   absolute path is something like
 *   `file:///.../Containers/Data/Application/<UUID>/Documents/`). Across
 *   a clean reinstall (e.g. `expo run:ios` rebuild, EAS install, or a
 *   simulator state reset) iOS regenerates the UUID; the persistent
 *   directory contents survive the move, but any *absolute* URIs we
 *   stored in AsyncStorage no longer resolve.
 *
 *   To stay robust, the manifest does NOT persist the absolute URI. We
 *   persist only the activity id, derive the file path on demand from
 *   the *current* `Paths.document`, and surface the freshly-computed
 *   URI on `StoredActivity.fitFileUri` so callers can hand it to
 *   `expo-sharing`, `expo-file-system`, etc.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import { encodeActivityToFit } from "./fit-writer";
import type { ActivitySummary, RecordedActivity } from "./types";

const MANIFEST_KEY = "rowerm8.activities.manifest.v1";
const ACTIVITIES_DIR_NAME = "activities";

/**
 * A persisted activity. `fitFileUri` is *derived* on read (not stored
 * in AsyncStorage) so it's always anchored to the current document
 * directory — see the URI-stability note at the top of this file.
 */
export type StoredActivity = {
  id: string;
  summary: ActivitySummary;
  fitFileUri: string;
};

/** Schema actually written to AsyncStorage. Intentionally narrower than
 * `StoredActivity` so we don't end up persisting derivable paths that
 * become stale across reinstalls. */
type ManifestEntry = {
  id: string;
  summary: ActivitySummary;
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

/** Path-only accessor — use this everywhere instead of caching `file.uri`,
 * because the absolute URI changes when iOS regenerates the data
 * container UUID (see the file header comment). */
function fitFileFor(id: string): File {
  return new File(Paths.document, ACTIVITIES_DIR_NAME, `${id}.fit`);
}

/** Attach the freshly-computed `fitFileUri` to a manifest entry so
 * callers don't have to know the directory layout. */
function hydrate(entry: ManifestEntry): StoredActivity {
  return { ...entry, fitFileUri: fitFileFor(entry.id).uri };
}

async function readManifest(): Promise<ManifestEntry[]> {
  const raw = await AsyncStorage.getItem(MANIFEST_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Older builds also persisted `fitFileUri`. We ignore that field on
    // read (see file header) — `hydrate()` recomputes it. Anything that
    // doesn't satisfy the manifest schema is dropped silently rather
    // than surfaced as a "history is broken" UI error.
    return (parsed as Partial<ManifestEntry>[])
      .filter(
        (e): e is ManifestEntry =>
          typeof e?.id === "string" && typeof e?.summary === "object",
      )
      .map(({ id, summary }) => ({ id, summary }));
  } catch {
    return [];
  }
}

async function writeManifest(entries: ManifestEntry[]): Promise<void> {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(entries));
}

/** Returns the manifest, newest-first, with `fitFileUri` pointing at
 * the current document directory. */
export async function listActivities(): Promise<StoredActivity[]> {
  const manifest = await readManifest();
  return manifest.map(hydrate);
}

/** Look up a single activity by id, or null if it isn't in the manifest. */
export async function getActivity(id: string): Promise<StoredActivity | null> {
  const manifest = await readManifest();
  const found = manifest.find((a) => a.id === id);
  return found ? hydrate(found) : null;
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
  ensureActivitiesDir();
  const file = fitFileFor(activity.id);
  // overwrite: true makes save() idempotent in the rare case the user
  // taps Save twice (e.g. retries after a transient failure).
  file.create({ overwrite: true });
  file.write(fitBytes);

  const entry: ManifestEntry = {
    id: activity.id,
    summary: activity.summary,
  };
  const manifest = await readManifest();
  // Newest first; this is also the order the History screen renders.
  manifest.unshift(entry);
  await writeManifest(manifest);
  return hydrate(entry);
}

/** Remove the activity from the manifest and delete its FIT file. */
export async function deleteActivity(id: string): Promise<void> {
  const manifest = await readManifest();
  const idx = manifest.findIndex((a) => a.id === id);
  if (idx === -1) {
    return;
  }
  try {
    const file = fitFileFor(id);
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
