import { useCallback } from "react";
import { syncEngine } from "@/offline/sync-engine";
import { useOfflineStore } from "@/state/offline/offline-store";
import { useIsOnline } from "./use-network";
import type { OfflineActionType } from "@/offline/types";

export function useOffline() {
  const isOnline = useIsOnline();
  const store = useOfflineStore();

  const enqueueAction = useCallback(
    async (action: {
      type: OfflineActionType;
      endpoint: string;
      method: "POST" | "PUT" | "PATCH" | "DELETE";
      payload: Record<string, unknown>;
    }) => {
      await syncEngine.enqueue(action);
    },
    []
  );

  const syncNow = useCallback(async () => {
    if (!isOnline) return { synced: 0, failed: 0, errors: [] };
    return syncEngine.sync();
  }, [isOnline]);

  const retryFailed = useCallback(async () => {
    if (!isOnline) return { synced: 0, failed: 0, errors: [] };
    return syncEngine.retryFailed();
  }, [isOnline]);

  const getQueueStatus = useCallback(() => {
    const queue = store.queue;
    return {
      total: queue.length,
      queued: queue.filter((a) => a.status === "queued").length,
      processing: queue.filter((a) => a.status === "processing").length,
      failed: queue.filter((a) => a.status === "failed").length,
      completed: queue.filter((a) => a.status === "completed").length,
    };
  }, [store.queue]);

  return {
    isOnline,
    isProcessing: store.isProcessing,
    lastSyncAt: store.lastSyncAt,
    queue: store.queue,
    queueStatus: getQueueStatus(),
    enqueueAction,
    syncNow,
    retryFailed,
    clearQueue: syncEngine.clearQueue,
  };
}
