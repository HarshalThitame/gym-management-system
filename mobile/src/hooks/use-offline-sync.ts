import { useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { syncEngine } from "@/offline/sync-engine";
import { useOfflineStore } from "@/state/offline/offline-store";
import { useAppStore } from "@/state/app/app-store";
import { networkMonitor } from "@/offline/network-monitor";
import { cacheEvictExpired } from "@/storage/sqlite-cache";
import { useIsOnline } from "./use-network";

export function useOfflineSync() {
  const isOnline = useIsOnline();
  const lastOnlineRef = useRef(isOnline);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (isOnline && !lastOnlineRef.current) {
      syncEngine.sync("recovery").then(() => {
        cacheEvictExpired();
      });
    }
    lastOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        if (networkMonitor.getIsOnline()) {
          syncEngine.sync("full").then(() => {
            cacheEvictExpired();
          });
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  const manualSync = useCallback(async () => {
    if (!isOnline) return { synced: 0, failed: 0, conflicts: 0, errors: [], mode: "full" as const };
    const result = await syncEngine.sync("full");
    await cacheEvictExpired();
    return result;
  }, [isOnline]);

  const retryFailed = useCallback(async () => {
    if (!isOnline) return { synced: 0, failed: 0, conflicts: 0, errors: [], mode: "recovery" as const };
    return syncEngine.retryFailed();
  }, [isOnline]);

  const status = syncEngine.getQueueStatus();

  return {
    isOnline,
    isProcessing: useOfflineStore.getState().isProcessing,
    lastSyncAt: useOfflineStore.getState().lastSyncAt,
    queueStatus: status,
    hasPendingItems: status.total > 0,
    hasFailedItems: status.failed > 0,
    manualSync,
    retryFailed,
  };
}
