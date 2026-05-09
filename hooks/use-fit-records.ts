/**
 * Read a FIT file from disk and decode it into a structured record stream
 * for charts.
 *
 * The hook caches the decoded payload in a module-level Map keyed by the
 * file URI so that re-mounting the detail screen (or focusing back from
 * Share) doesn't re-parse the bytes. Parsing is fast on a phone, but a
 * 30-minute activity is ~1800 records and re-doing the work on every
 * focus is pure waste.
 */
import { File } from "expo-file-system";
import { useEffect, useState } from "react";

import {
  decodeFitToActivity,
  type DecodedActivity,
} from "@/lib/activity/fit-reader";

type CacheEntry = {
  promise: Promise<DecodedActivity>;
};

const cache = new Map<string, CacheEntry>();

async function readAndDecode(uri: string): Promise<DecodedActivity> {
  const file = new File(uri);
  if (!file.exists) {
    throw new Error(`FIT file does not exist: ${uri}`);
  }
  const bytes = await file.bytes();
  return decodeFitToActivity(bytes);
}

function getOrLoad(uri: string): Promise<DecodedActivity> {
  const existing = cache.get(uri);
  if (existing) {
    return existing.promise;
  }
  const promise = readAndDecode(uri).catch((err) => {
    // Drop the failed promise from the cache so the next attempt retries
    // (e.g. user returns after granting permission, fixing the file, etc.).
    cache.delete(uri);
    throw err;
  });
  cache.set(uri, { promise });
  return promise;
}

export type UseFitRecordsState = {
  decoded: DecodedActivity | null;
  isLoading: boolean;
  error: Error | null;
};

export function useFitRecords(uri: string | undefined): UseFitRecordsState {
  const [decoded, setDecoded] = useState<DecodedActivity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!uri);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uri) {
      setDecoded(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getOrLoad(uri)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setDecoded(result);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setDecoded(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return { decoded, isLoading, error };
}

/** Test-only: clear the in-memory decode cache. */
export function __resetFitRecordsCache(): void {
  cache.clear();
}
