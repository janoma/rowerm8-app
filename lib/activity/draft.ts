/**
 * Draft persistence for in-flight rowing activities.
 *
 * The Free Row screen flushes a JSON snapshot of the recorder to disk
 * every few seconds (and on AppState transitions). If the OS kills the
 * app, the user force-closes it, or anything else interrupts the
 * recording, those drafts let us recover on the next launch:
 *
 *   - within `RESUME_WINDOW_MS` of the last sample → offer Resume / Save / Discard
 *   - older than `RESUME_WINDOW_MS` but younger than `DRAFT_HARD_TTL_MS`
 *     → offer Save / Discard only (no Resume)
 *   - older than `DRAFT_HARD_TTL_MS` → silently deleted on boot
 *
 * Files live under `Paths.document/activities/drafts/<id>.json`. We keep
 * the same `id` the recorder generated at `start()` so a finalized
 * activity preserves the original id (and its FIT file URL).
 *
 * The module is intentionally self-contained: no React, no AsyncStorage,
 * no recorder coupling. Callers serialize the recorder via
 * `recorder.serialize(...)` and pass the plain object here.
 */
import { Directory, File, Paths } from "expo-file-system";

import type { ActivityDraft } from "./types";

const DRAFTS_DIR_NAME = "activities/drafts";

/**
 * Window during which a draft may still be resumed (1 hour). Beyond this
 * threshold the recovery UI hides the Resume option but still offers
 * Save (truncated to the last sample) and Discard.
 */
export const RESUME_WINDOW_MS = 60 * 60 * 1_000;

/**
 * Hard upper bound for keeping a draft on disk (7 days). Drafts older
 * than this are auto-deleted on cold start without prompting the user.
 */
export const DRAFT_HARD_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

/** Bytes-per-flush soft cap. Older builds saved drafts up to a few hundred KB; this is a defensive guard against runaway record arrays. */
const MAX_DRAFT_BYTES = 4 * 1024 * 1024;

function draftsDir(): Directory {
  return new Directory(Paths.document, DRAFTS_DIR_NAME);
}

function ensureDraftsDir(): Directory {
  const dir = draftsDir();
  if (!dir.exists) {
    // intermediates: true creates Documents/activities/ if needed.
    dir.create({ intermediates: true });
  }
  return dir;
}

function draftFileFor(id: string): File {
  return new File(Paths.document, DRAFTS_DIR_NAME, `${id}.json`);
}

function isActivityDraft(value: unknown): value is ActivityDraft {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const v = value as Partial<ActivityDraft>;
  return (
    v.schemaVersion === 1 &&
    typeof v.id === "string" &&
    typeof v.startedAtMs === "number" &&
    typeof v.lastEventAtMs === "number" &&
    typeof v.pausedMs === "number" &&
    Array.isArray(v.records) &&
    Array.isArray(v.strokes) &&
    Array.isArray(v.pauses) &&
    (v.motionSource === "phone" || v.motionSource === "ble") &&
    (v.uiPhase === "running" || v.uiPhase === "paused")
  );
}

/** Persist `draft` to disk, overwriting any prior copy with the same id. */
export function writeDraft(draft: ActivityDraft): void {
  const json = JSON.stringify(draft);
  if (json.length > MAX_DRAFT_BYTES) {
    // We never hit this in practice (per-second snapshots, multi-hour
    // sessions still come in well under a megabyte), but the recorder
    // has no built-in upper bound on records.length so we'd rather
    // skip a flush than write a multi-megabyte JSON every 5 s.
    console.warn(
      "[activity/draft] skipping flush: payload exceeds soft cap",
      json.length,
    );
    return;
  }
  ensureDraftsDir();
  const file = draftFileFor(draft.id);
  file.create({ overwrite: true });
  file.write(json);
}

/** Read a single draft by id, or null if missing/unreadable/stale-shaped. */
export function loadDraft(id: string): ActivityDraft | null {
  const file = draftFileFor(id);
  if (!file.exists) {
    return null;
  }
  try {
    const raw = file.textSync();
    const parsed = JSON.parse(raw);
    if (!isActivityDraft(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Delete the draft file for `id`. No-op if it doesn't exist. */
export function deleteDraft(id: string): void {
  try {
    const file = draftFileFor(id);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort. If we can't delete, the next flush will overwrite,
    // and the hard-TTL sweep will eventually clean it up.
  }
}

/** All drafts currently on disk that parse cleanly. Newest first. */
export function listDrafts(): ActivityDraft[] {
  const dir = draftsDir();
  if (!dir.exists) {
    return [];
  }
  let entries: (File | Directory)[];
  try {
    entries = dir.list();
  } catch {
    return [];
  }
  const drafts: ActivityDraft[] = [];
  for (const entry of entries) {
    if (!(entry instanceof File)) {
      continue;
    }
    if (!entry.uri.endsWith(".json")) {
      continue;
    }
    try {
      const raw = entry.textSync();
      const parsed = JSON.parse(raw);
      if (isActivityDraft(parsed)) {
        drafts.push(parsed);
      }
    } catch {
      // Ignore malformed files; the hard-TTL sweep will remove them
      // eventually.
    }
  }
  drafts.sort((a, b) => b.lastEventAtMs - a.lastEventAtMs);
  return drafts;
}

/** Most recent draft (by `lastEventAtMs`), or null if none exist. */
export function mostRecentDraft(): ActivityDraft | null {
  const drafts = listDrafts();
  return drafts.length > 0 ? drafts[0] : null;
}

/**
 * Delete every draft file (parseable or not) older than
 * {@link DRAFT_HARD_TTL_MS} relative to `nowMs`. Returns the number of
 * files removed.
 */
export function pruneStaleDrafts(nowMs: number): number {
  const dir = draftsDir();
  if (!dir.exists) {
    return 0;
  }
  let entries: (File | Directory)[];
  try {
    entries = dir.list();
  } catch {
    return 0;
  }
  let removed = 0;
  for (const entry of entries) {
    if (!(entry instanceof File)) {
      continue;
    }
    if (!entry.uri.endsWith(".json")) {
      continue;
    }
    let shouldDelete = false;
    try {
      const raw = entry.textSync();
      const parsed = JSON.parse(raw);
      if (isActivityDraft(parsed)) {
        if (nowMs - parsed.lastEventAtMs > DRAFT_HARD_TTL_MS) {
          shouldDelete = true;
        }
      } else {
        // Anything with the .json extension that doesn't match the
        // schema is junk; clean it up so the directory doesn't grow
        // unbounded across schema migrations.
        shouldDelete = true;
      }
    } catch {
      shouldDelete = true;
    }
    if (shouldDelete) {
      try {
        entry.delete();
        removed += 1;
      } catch {
        // Ignore deletion failures.
      }
    }
  }
  return removed;
}

/**
 * Whether `draft` is fresh enough to offer the user a Resume option.
 * The threshold is measured from the draft's most recent recorded event
 * (tick or stroke), not from the start time, so a long active session
 * still qualifies.
 */
export function canResumeDraft(draft: ActivityDraft, nowMs: number): boolean {
  return nowMs - draft.lastEventAtMs <= RESUME_WINDOW_MS;
}
