"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Check if error is from request cancellation (abort/timeout). */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Fetch data when deps change, with loading/error state and request cancellation.
 * Pass a fetch function that accepts AbortSignal so in-flight requests are aborted on unmount or deps change.
 * Enterprise: no stale updates, no leaked requests.
 */
export function useAsyncData<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
): {
  data: T | null;
  error: string;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refetchIdRef = useRef(0);

  const refetch = useCallback(async () => {
    refetchIdRef.current += 1;
    const id = refetchIdRef.current;
    setError("");
    setLoading(true);
    const ac = new AbortController();
    try {
      const result = await fetchFn(ac.signal);
      if (id === refetchIdRef.current) setData(result);
    } catch (err) {
      if (id === refetchIdRef.current && !isAbortError(err)) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (id === refetchIdRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    const ac = new AbortController();
    setError("");
    setLoading(true);
    fetchFn(ac.signal)
      .then((result) => {
        if (!ac.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!ac.signal.aborted && !isAbortError(err)) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch };
}
