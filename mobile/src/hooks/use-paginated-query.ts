import { useState, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/api/supabase";

interface PaginatedState<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  total: number;
}

export function usePaginatedQuery<T extends Record<string, any>>(
  table: string,
  baseQuery: (qb: any) => any,
  pageSize = 20
) {
  const [state, setState] = useState<PaginatedState<T>>({
    data: [], loading: true, loadingMore: false, hasMore: true, error: null, total: 0,
  });
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      let query = supabase.from(table).select("*", { count: "exact" });
      query = baseQuery(query);
      const { data, error, count } = await query.range(0, pageSize - 1);

      if (error) { setState((s) => ({ ...s, loading: false, error: error.message })); return; }

      offsetRef.current = pageSize;
      setState({
        data: (data ?? []) as T[],
        loading: false,
        loadingMore: false,
        hasMore: (data?.length ?? 0) >= pageSize,
        error: null,
        total: count ?? 0,
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : "Failed" }));
    } finally { loadingRef.current = false; }
  }, [table, pageSize, baseQuery]);

  const loadMore = useCallback(async () => {
    if (state.loading || state.loadingMore || !state.hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setState((s) => ({ ...s, loadingMore: true }));

    try {
      const supabase = getSupabaseClient();
      let query = supabase.from(table).select("*", { count: "exact" });
      query = baseQuery(query);
      const { data, error } = await query.range(offsetRef.current, offsetRef.current + pageSize - 1);

      if (error) { setState((s) => ({ ...s, loadingMore: false, error: error.message })); return; }

      const newItems = (data ?? []) as T[];
      offsetRef.current += pageSize;
      setState((s) => ({
        ...s,
        data: [...s.data, ...newItems],
        loadingMore: false,
        hasMore: newItems.length >= pageSize,
      }));
    } catch (err) {
      setState((s) => ({ ...s, loadingMore: false, error: err instanceof Error ? err.message : "Failed" }));
    } finally { loadingRef.current = false; }
  }, [state.loading, state.loadingMore, state.hasMore, table, pageSize, baseQuery]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    load();
  }, [load]);

  return { ...state, loadMore, refresh };
}
