/**
 * React hook around the activity storage layer.
 *
 * Reads the manifest from AsyncStorage, exposes it as state, and refreshes
 * automatically when the screen regains focus (so a row recorded on the
 * Free Row screen shows up the next time the user opens History without
 * an extra tap). Mutations (`remove`) update the local state optimistically
 * so the UI feels instant.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  deleteActivity,
  getActivity,
  listActivities,
  type StoredActivity,
} from "@/lib/activity/storage";

export type UseActivitiesState = {
  activities: StoredActivity[];
  /** True until the first read completes. After that we keep the previous
   * list visible during refreshes so the screen doesn't flash empty. */
  isLoading: boolean;
  /** Force a manual refresh (pull-to-refresh, post-mutation, etc.). */
  refresh: () => Promise<void>;
  /** Remove an activity from disk + manifest, optimistically updating
   * `activities` so the row disappears immediately. */
  remove: (id: string) => Promise<void>;
};

export function useActivities(): UseActivitiesState {
  const [activities, setActivities] = useState<StoredActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await listActivities();
    setActivities(next);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-read whenever the screen regains focus. This is what makes a fresh
  // save show up immediately without the user manually pulling to refresh.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const remove = useCallback(async (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
    try {
      await deleteActivity(id);
    } catch {
      // Roll back the optimistic removal by re-reading the manifest. We
      // intentionally don't surface the error here — the screen calling
      // remove() has more context to decide how to talk to the user.
      const next = await listActivities();
      setActivities(next);
      throw new Error(`Failed to delete activity ${id}`);
    }
  }, []);

  return { activities, isLoading, refresh, remove };
}

export type UseActivityState = {
  activity: StoredActivity | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Companion hook for the detail screen. Reads a single manifest entry by
 * id and re-reads on focus so post-share / post-delete UI stays accurate.
 */
export function useActivity(id: string | undefined): UseActivityState {
  const [activity, setActivity] = useState<StoredActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setActivity(null);
      setIsLoading(false);
      return;
    }
    const next = await getActivity(id);
    setActivity(next);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { activity, isLoading, refresh };
}
