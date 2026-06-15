import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { syncEngine } from "./sync-engine";
import { networkMonitor } from "./network-monitor";
import { DEFAULT_OFFLINE_CONFIG } from "./types";

const BACKGROUND_SYNC_TASK = "apex-background-sync";
const CHECK_INTERVAL_MIN = DEFAULT_OFFLINE_CONFIG.backgroundSyncIntervalMin;

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    if (!networkMonitor.getIsOnline()) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const status = syncEngine.getQueueStatus();
    if (status.total === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const result = await syncEngine.sync("batch");
    return result.synced > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) return;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: CHECK_INTERVAL_MIN * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {}
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }
  } catch {}
}

export async function getBackgroundSyncStatus(): Promise<{ registered: boolean; intervalMin: number }> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  return { registered: isRegistered, intervalMin: CHECK_INTERVAL_MIN };
}
