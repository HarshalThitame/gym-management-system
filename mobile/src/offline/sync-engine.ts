import { apiClient } from "@/api/client";
import { secureStorage } from "@/storage/secure";
import { useOfflineStore } from "@/state/offline/offline-store";
import { useAppStore } from "@/state/app/app-store";
import { DEFAULT_OFFLINE_CONFIG, getActionPriority } from "./types";
import type { OfflineAction, SyncResult, SyncMode, ConflictRecord } from "./types";

const STORAGE_KEY_QUEUE = "apex_offline_queue_v2";
const STORAGE_KEY_CONFLICTS = "apex_offline_conflicts";

class SyncEngine {
  private config = DEFAULT_OFFLINE_CONFIG;
  private isSyncing = false;
  private syncCallbacks: Array<(result: SyncResult) => void> = [];

  onSyncComplete(callback: (result: SyncResult) => void): () => void {
    this.syncCallbacks.push(callback);
    return () => { this.syncCallbacks = this.syncCallbacks.filter((cb) => cb !== callback); };
  }

  async enqueue(type: OfflineAction["type"], payload: Record<string, unknown>, context?: Record<string, string>): Promise<OfflineAction> {
    const store = useOfflineStore.getState();
    if (store.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Offline queue full (${this.config.maxQueueSize} max). Complete pending syncs first.`);
    }

    const { getActionEndpoint } = await import("./types");
    const action: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type,
      endpoint: getActionEndpoint(type, context ?? {}),
      method: type === "lead_creation" || type === "member_registration" || type === "billing_request" || type === "lead_note" ? "POST" : "PATCH",
      payload: { ...payload, _queuedAt: new Date().toISOString() },
      idempotencyKey: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      lastError: null,
      status: "queued",
      priority: getActionPriority(type),
    };

    store.addToQueue(action);
    await this.persistQueue();

    if (useAppStore.getState().isOnline) {
      this.sync("partial").catch(() => {});
    }

    return action;
  }

  async sync(mode: SyncMode = "full"): Promise<SyncResult> {
    if (this.isSyncing) return { synced: 0, failed: 0, conflicts: 0, errors: [], mode };
    this.isSyncing = true;
    useOfflineStore.getState().setProcessing(true);
    useAppStore.getState().setSyncing(true);

    const result: SyncResult = { synced: 0, failed: 0, conflicts: 0, errors: [], mode };
    const store = useOfflineStore.getState();

    let pending = store.queue.filter((a) => a.status === "queued" || (a.status === "failed" && a.retryCount < a.maxRetries));

    if (mode === "partial") {
      pending = pending.filter((a) => a.priority === "high").slice(0, this.config.batchSize);
    } else if (mode === "batch") {
      pending = pending.slice(0, this.config.batchSize);
    }

    if (pending.length === 0) {
      this.isSyncing = false;
      useOfflineStore.getState().setProcessing(false);
      useAppStore.getState().setSyncing(false);
      return result;
    }

    const batchSize = mode === "full" ? Math.min(pending.length, 50) : Math.min(pending.length, this.config.batchSize);
    const batch = pending.slice(0, batchSize);

    for (const action of batch) {
      try {
        useOfflineStore.getState().updateAction(action.id, { status: "processing" });
        const response = await apiClient.post("/pwa/sync", {
          actions: [{
            id: action.id,
            action_type: action.type,
            endpoint: action.endpoint,
            method: action.method,
            payload: action.payload,
            idempotency_key: action.idempotencyKey,
            created_offline_at: action.createdAt,
            conflict_strategy: action.conflictStrategy ?? "last_write_wins",
          }],
        });

        if (response.ok) {
          useOfflineStore.getState().removeFromQueue(action.id);
          result.synced++;
        } else if (response.status === 409) {
          this.handleConflict(action, response.data as Record<string, unknown>);
          result.conflicts++;
          result.errors.push({ id: action.id, error: "Conflict detected", conflict: true });
        } else {
          const error = response.error?.message ?? "Sync failed";
          useOfflineStore.getState().updateAction(action.id, {
            status: "failed", retryCount: action.retryCount + 1, lastError: error,
          });
          result.failed++;
          result.errors.push({ id: action.id, error });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        useOfflineStore.getState().updateAction(action.id, {
          status: "failed", retryCount: action.retryCount + 1, lastError: msg,
        });
        result.failed++;
        result.errors.push({ id: action.id, error: msg });
      }
    }

    useOfflineStore.getState().setLastSync(new Date().toISOString());
    useOfflineStore.getState().setProcessing(false);
    useAppStore.getState().setSyncing(false);
    this.isSyncing = false;

    await this.persistQueue();
    this.syncCallbacks.forEach((cb) => cb(result));
    return result;
  }

  private async handleConflict(action: OfflineAction, serverData: Record<string, unknown>): Promise<void> {
    try {
      const conflict: ConflictRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actionId: action.id,
        localData: action.payload,
        serverData,
        resolvedData: null,
        strategy: action.conflictStrategy ?? "last_write_wins",
        status: "pending",
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };

      const existing = await this.getConflicts();
      existing.push(conflict);
      await secureStorage.setJSON(STORAGE_KEY_CONFLICTS as never, existing);
    } catch {}
  }

  async retryFailed(): Promise<SyncResult> {
    const store = useOfflineStore.getState();
    const failed = store.queue.filter((a) => a.status === "failed");
    for (const action of failed) {
      useOfflineStore.getState().updateAction(action.id, { status: "queued" });
    }
    return this.sync("recovery");
  }

  async clearQueue(): Promise<void> {
    useOfflineStore.getState().clearQueue();
    await secureStorage.delete(STORAGE_KEY_QUEUE as never);
  }

  async restoreQueue(): Promise<void> {
    const stored = await secureStorage.getJSON<OfflineAction[]>(STORAGE_KEY_QUEUE as never);
    if (stored && Array.isArray(stored)) {
      for (const action of stored) {
        useOfflineStore.getState().addToQueue(action);
      }
    }
  }

  async getConflicts(): Promise<ConflictRecord[]> {
    try { return (await secureStorage.getJSON<ConflictRecord[]>(STORAGE_KEY_CONFLICTS as never)) ?? []; } catch { return []; }
  }

  async resolveConflict(conflictId: string, resolvedData: Record<string, unknown>): Promise<boolean> {
    try {
      const conflicts = await this.getConflicts();
      const idx = conflicts.findIndex((c) => c.id === conflictId);
      if (idx === -1) return false;
      conflicts[idx] = { ...conflicts[idx], resolvedData, status: "resolved", resolvedAt: new Date().toISOString() };
      await secureStorage.setJSON(STORAGE_KEY_CONFLICTS as never, conflicts);
      return true;
    } catch { return false; }
  }

  getQueueStatus() {
    const store = useOfflineStore.getState();
    return {
      total: store.queue.length,
      queued: store.queue.filter((a) => a.status === "queued").length,
      processing: store.queue.filter((a) => a.status === "processing").length,
      failed: store.queue.filter((a) => a.status === "failed").length,
      highPriority: store.queue.filter((a) => a.priority === "high" && a.status === "queued").length,
      progress: store.queue.length > 0 ? Math.round((store.queue.filter((a) => a.status === "completed").length / store.queue.length) * 100) : 100,
    };
  }

  private async persistQueue(): Promise<void> {
    const queue = useOfflineStore.getState().queue;
    await secureStorage.setJSON(STORAGE_KEY_QUEUE as never, queue);
  }
}

export const syncEngine = new SyncEngine();
