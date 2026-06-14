"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";

type OptimisticAction<T> =
  | { type: "create"; item: T }
  | { type: "update"; id: string; item: Partial<T> }
  | { type: "delete"; id: string }
  | { type: "set"; items: T[] };

export function useOptimisticList<T extends { id: string }>(initialItems: T[]) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [optimisticItems, addOptimisticAction] = useOptimistic(items, (state, action: OptimisticAction<T>) => {
    switch (action.type) {
      case "create":
        return [action.item, ...state];
      case "update":
        return state.map((item) => (item.id === action.id ? { ...item, ...action.item } : item));
      case "delete":
        return state.filter((item) => item.id !== action.id);
      case "set":
        return action.items;
      default:
        return state;
    }
  });

  const syncItems = useCallback((newItems: T[]) => {
    setItems(newItems);
    addOptimisticAction({ type: "set", items: newItems });
  }, [addOptimisticAction]);

  return {
    items: optimisticItems,
    addOptimistic: (item: T) => addOptimisticAction({ type: "create", item }),
    updateOptimistic: (id: string, item: Partial<T>) => addOptimisticAction({ type: "update", id, item }),
    removeOptimistic: (id: string) => addOptimisticAction({ type: "delete", id }),
    syncItems,
    refreshFromServer: (serverItems: T[]) => setItems(serverItems)
  };
}

export function useAsyncAction() {
  const [isPending, startTransition] = useTransition();

  const execute = useCallback(async <T>(action: Promise<T>): Promise<T | null> => {
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const result = await action;
          resolve(result);
        } catch {
          resolve(null);
        }
      });
    });
  }, [startTransition]);

  return { isPending, execute };
}
