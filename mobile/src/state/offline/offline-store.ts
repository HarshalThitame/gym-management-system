import { create } from "zustand";

export interface QueuedAction {
  id: string;
  type: "workout_log" | "nutrition_log" | "profile_update" | "attendance_check_in" | "attendance_check_out" | "class_booking_request";
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
}

interface OfflineStoreState {
  queue: QueuedAction[];
  isProcessing: boolean;
  lastSyncAt: string | null;

  addToQueue: (action: QueuedAction) => void;
  removeFromQueue: (id: string) => void;
  updateAction: (id: string, updates: Partial<QueuedAction>) => void;
  setProcessing: (processing: boolean) => void;
  setLastSync: (timestamp: string) => void;
  clearQueue: () => void;
  getQueueByType: (type: QueuedAction["type"]) => QueuedAction[];
}

export const useOfflineStore = create<OfflineStoreState>((set, get) => ({
  queue: [],
  isProcessing: false,
  lastSyncAt: null,

  addToQueue: (action) =>
    set((state) => ({ queue: [...state.queue, action] })),

  removeFromQueue: (id) =>
    set((state) => ({ queue: state.queue.filter((a) => a.id !== id) })),

  updateAction: (id, updates) =>
    set((state) => ({
      queue: state.queue.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  setProcessing: (processing) => set({ isProcessing: processing }),

  setLastSync: (timestamp) => set({ lastSyncAt: timestamp }),

  clearQueue: () => set({ queue: [] }),

  getQueueByType: (type) => get().queue.filter((a) => a.type === type),
}));
