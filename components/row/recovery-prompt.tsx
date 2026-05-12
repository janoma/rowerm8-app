/**
 * Recovery prompt for an in-flight rowing activity that survived a
 * force-close (or OS kill) and is still on disk as a draft.
 *
 * The Free Row screen surfaces this modal when its `recover` route
 * param points at a draft id. Within the resume window (1 hour since
 * the last sample) we offer Resume / Save now / Discard; outside the
 * window — but still within the hard TTL — we hide the Resume option
 * and only offer Save / Discard. Save preserves the work; Discard
 * lets the user start clean.
 *
 * The modal styling mirrors the existing `AutoStartModal` so the
 * Recording flow has a consistent visual identity in both directions
 * (start-of-session and recovery-of-session).
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Modal, StyleSheet, Text, View } from "react-native";

import { Button, useTheme } from "@/lib/design-system";
import {
  canResumeDraft,
  loadDraft,
  RESUME_WINDOW_MS,
} from "@/lib/activity/draft";
import { formatDuration } from "@/lib/format/time";
import type { ActivityDraft } from "@/lib/activity/types";

type Props = {
  /**
   * Id of the draft to recover. `null` hides the modal. Changing this
   * prop reloads the draft from disk (we don't memoize stale data
   * across multiple recoveries).
   */
  draftId: string | null;
  onResume: () => void;
  onSaveNow: () => void;
  onDiscard: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_MAX_WIDTH = 360;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, CARD_MAX_WIDTH);

function formatAgeMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

export function RecoveryPrompt({
  draftId,
  onResume,
  onSaveNow,
  onDiscard,
}: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("row");

  // Load the draft summary when the id changes. We only need the
  // headline numbers (started-at, duration, stroke count) — the
  // recorder takes care of the per-record arrays on Resume.
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  useEffect(() => {
    if (draftId == null) {
      setDraft(null);
      return;
    }
    setDraft(loadDraft(draftId));
  }, [draftId]);

  // Capture "now" once per modal open so the displayed age doesn't
  // tick. Recompute when the draft id changes.
  const [openedAtMs, setOpenedAtMs] = useState(() => Date.now());
  useEffect(() => {
    if (draftId != null) {
      setOpenedAtMs(Date.now());
    }
  }, [draftId]);

  const visible = draftId != null && draft != null;

  const resumeAllowed = useMemo(() => {
    if (!draft) {
      return false;
    }
    return canResumeDraft(draft, openedAtMs);
  }, [draft, openedAtMs]);

  const ageMinutes = useMemo(
    () => (draft ? formatAgeMinutes(openedAtMs - draft.lastEventAtMs) : 0),
    [draft, openedAtMs],
  );

  const movingDurationS = useMemo(() => {
    if (!draft) {
      return 0;
    }
    if (draft.records.length === 0) {
      return 0;
    }
    return draft.records[draft.records.length - 1].elapsedS;
  }, [draft]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDiscard}
      statusBarTranslucent
    >
      <View
        style={[styles.backdrop, { backgroundColor: tokens.colors.overlay }]}
      >
        <View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              backgroundColor: tokens.colors.surface,
              borderRadius: tokens.radius.xl,
              borderColor: tokens.colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: tokens.colors.text }]}>
            {t("freeRow.recovery.title")}
          </Text>
          <Text style={[styles.body, { color: tokens.colors.textSecondary }]}>
            {t(
              resumeAllowed
                ? "freeRow.recovery.bodyResumable"
                : "freeRow.recovery.bodyExpired",
              {
                duration: formatDuration(movingDurationS),
                strokes: draft?.strokes.length ?? 0,
                ageMinutes,
                resumeWindowMinutes: Math.round(RESUME_WINDOW_MS / 60_000),
              },
            )}
          </Text>
          {resumeAllowed ? (
            <Button
              title={t("freeRow.recovery.resume")}
              onPress={onResume}
              icon="play.fill"
              tone="accent"
              variant="filled"
              size="lg"
              block
            />
          ) : null}
          <Button
            title={t("freeRow.recovery.saveNow")}
            onPress={onSaveNow}
            icon="checkmark.circle.fill"
            tone={resumeAllowed ? "neutral" : "accent"}
            variant={resumeAllowed ? "tinted" : "filled"}
            size="lg"
            block
          />
          <Button
            title={t("freeRow.recovery.discard")}
            onPress={onDiscard}
            icon="trash"
            tone="danger"
            variant="tinted"
            size="md"
            block
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 22,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
