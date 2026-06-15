import { useState, useCallback, useRef } from "react";

interface OptimisticState<T> {
  data: T;
  pending: boolean;
  error: string | null;
}

export function useOptimistic<T>(initialData: T) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    pending: false,
    error: null,
  });

  const rollbackRef = useRef<T>(initialData);

  const execute = useCallback(async (
    optimisticUpdate: (current: T) => T,
    asyncAction: () => Promise<boolean>,
    rollback?: boolean
  ) => {
    rollbackRef.current = state.data;
    const optimisticData = optimisticUpdate(state.data);

    setState({ data: optimisticData, pending: true, error: null });

    try {
      const success = await asyncAction();
      if (success) {
        setState({ data: optimisticData, pending: false, error: null });
        return true;
      } else {
        if (rollback !== false) {
          setState({ data: rollbackRef.current, pending: false, error: "Action failed" });
        } else {
          setState({ data: optimisticData, pending: false, error: "Action failed" });
        }
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      if (rollback !== false) {
        setState({ data: rollbackRef.current, pending: false, error: msg });
      } else {
        setState({ data: optimisticData, pending: false, error: msg });
      }
      return false;
    }
  }, [state.data]);

  return {
    data: state.data,
    pending: state.pending,
    error: state.error,
    execute,
    setData: (data: T) => setState({ data, pending: false, error: null }),
    clearError: () => setState((s) => ({ ...s, error: null })),
  };
}
