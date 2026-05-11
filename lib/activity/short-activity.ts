/**
 * "Is this activity worth saving?" classifier.
 *
 * Tap-then-stop slips, accidental Start presses, and the like can
 * leave behind a recording that's effectively noise — a few stray
 * strokes captured during calibration, or a session ended within
 * seconds. We don't want to silently drop those (the user might
 * actually want them), but we also don't want to clutter the history
 * with garbage. The Free Row screen consults this classifier on Stop
 * and, when it returns a non-null reason, prompts the user to keep
 * or discard the recording.
 *
 * Pure module, no React / no I/O — kept here so the thresholds and
 * decision are unit-testable and shareable with non-Free-Row entry
 * points down the line (workouts, etc.).
 */

/** Minimum stroke count for an activity to save without prompting. */
export const SHORT_ACTIVITY_MIN_STROKES = 10;

/** Minimum moving duration (seconds) for an activity to save without prompting. */
export const SHORT_ACTIVITY_MIN_DURATION_S = 30;

/**
 * Why a recording was flagged as too short. `null` means it cleared
 * both thresholds and should save without prompting.
 */
export type ShortActivityReason =
  | "fewStrokes"
  | "shortDuration"
  | "both"
  | null;

/**
 * Decide whether `(strokeCount, durationS)` should trigger the
 * keep/discard prompt. Negative or non-finite inputs are coerced
 * toward "too short" so a malformed recording always trips the
 * prompt rather than slipping through silently.
 */
export function classifyShortActivity(
  strokeCount: number,
  durationS: number,
): ShortActivityReason {
  const safeStrokes = Number.isFinite(strokeCount) ? strokeCount : 0;
  const safeDuration = Number.isFinite(durationS) ? durationS : 0;
  const fewStrokes = safeStrokes < SHORT_ACTIVITY_MIN_STROKES;
  const shortDuration = safeDuration < SHORT_ACTIVITY_MIN_DURATION_S;
  if (fewStrokes && shortDuration) {
    return "both";
  }
  if (fewStrokes) {
    return "fewStrokes";
  }
  if (shortDuration) {
    return "shortDuration";
  }
  return null;
}
