import { useCallback, useEffect, useState } from "react";
import { call } from "@/lib/call";
import type { Paged } from "@/lib/types";

interface Loaded<T> {
  key: string;
  data: T[];
  total: number;
  error: string | null;
}

// Loads one page of a list through a server action, again whenever `params` change or
// reload() is called. `fetchPage` must be a stable reference (the imported action itself).
export function usePagedList<P extends object, T>(fetchPage: (params: P) => Promise<Paged<T>>, params: P) {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const paramsKey = JSON.stringify(params);
  const key = `${version}:${paramsKey}`;

  useEffect(() => {
    let cancelled = false;
    call(fetchPage(JSON.parse(paramsKey) as P)).then((res) => {
      if (cancelled) return;
      setLoaded(
        res.error === null
          ? { key, data: res.data, total: res.total, error: null }
          : { key, data: [], total: 0, error: res.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, paramsKey, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loading = loaded?.key !== key;

  return {
    // Rows of the previous page stay visible (and `ready` stays true) while the next one loads.
    rows: loaded?.data ?? [],
    total: loaded?.total ?? 0,
    ready: loaded !== null && loaded.error === null,
    error: loading ? null : (loaded?.error ?? null),
    loading,
    reload,
  };
}
