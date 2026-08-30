import { useCallback, useEffect, useRef, useState } from "react";

import { errorMessage } from "@/lib/tauri";
import { useUiStore } from "@/store/uiStore";

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * A local SQLite call comes back in single-digit milliseconds, so there is nothing to
 * cache and no network-style library to justify — this hook is the whole data layer.
 *
 * It re-runs when its `deps` change and when `revision` bumps, which is how a mutation
 * anywhere refreshes every affected view.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options: { enabled?: boolean } = {},
): QueryResult<T> {
  const enabled = options.enabled ?? true;
  const revision = useUiStore((s) => s.revision);

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  // Keeps the latest fetcher without making it a dependency — callers pass an inline
  // closure, which would otherwise re-run this effect on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision, nonce, enabled]);

  return { data, error, loading, reload };
}
