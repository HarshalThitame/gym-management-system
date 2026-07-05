"use client";

import type { Json } from "@/types/database";
import { isQueueableOfflineAction, type QueueableOfflineActionType } from "./business-rules";

const DB_NAME = "apex-pwa-store";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const SNAPSHOT_STORE = "snapshots";
const DRAFT_STORE = "drafts";
const METRIC_STORE = "metrics";

export type QueuedOfflineAction = {
  id: string;
  type: QueueableOfflineActionType;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: Json;
  idempotencyKey: string;
  createdAt: string;
};

export type CachedSnapshot<TValue extends Json = Json> = {
  key: string;
  value: TValue;
  cachedAt: string;
  expiresAt?: string;
};

export type PwaMetricEvent = {
  id: string;
  eventType: "install_prompt_shown" | "install_accepted" | "install_dismissed" | "standalone_open" | "push_opt_in" | "offline_action_queued" | "offline_sync_completed";
  route: string;
  metadata: Json;
  createdAt: string;
};

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: {
    register: (tag: string) => Promise<void>;
  };
};

export function isIndexedDbAvailable() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export async function queueOfflineAction(input: Omit<QueuedOfflineAction, "id" | "idempotencyKey" | "createdAt"> & { id?: string; idempotencyKey?: string; createdAt?: string }) {
  if (!isQueueableOfflineAction(input.type)) {
    throw new Error("This action type is not approved for offline queueing.");
  }

  const action: QueuedOfflineAction = {
    ...input,
    id: input.id ?? createId(),
    idempotencyKey: input.idempotencyKey ?? createId(),
    createdAt: input.createdAt ?? new Date().toISOString()
  };

  const db = await openDatabase();
  await putRecord(db, OUTBOX_STORE, action);
  await postToServiceWorker({ type: "QUEUE_OFFLINE_ACTION", payload: action });
  await registerBackgroundSync();
  await trackPwaEvent("offline_action_queued", { type: action.type, endpoint: action.endpoint });

  return action;
}

export async function getQueuedOfflineActions() {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  const db = await openDatabase();
  return readAll<QueuedOfflineAction>(db, OUTBOX_STORE);
}

export async function flushOfflineActions() {
  const actions = await getQueuedOfflineActions();

  if (actions.length === 0 || !navigator.onLine) {
    return { synced: 0 };
  }

  const response = await fetch("/api/pwa/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actions })
  });

  if (!response.ok) {
    throw new Error("Offline sync failed.");
  }

  const body: unknown = await response.json().catch(() => null);
  const processedIds = getProcessedIds(body);
  const idsToDelete = processedIds.length > 0 ? processedIds : actions.map((action) => action.id);
  const db = await openDatabase();

  await Promise.all(idsToDelete.map((id) => deleteRecord(db, OUTBOX_STORE, id)));
  await trackPwaEvent("offline_sync_completed", { synced: idsToDelete.length });

  return { synced: idsToDelete.length };
}

export async function saveCachedSnapshot<TValue extends Json>(snapshot: CachedSnapshot<TValue>) {
  const db = await openDatabase();
  await putRecord(db, SNAPSHOT_STORE, snapshot);
  return snapshot;
}

export async function getCachedSnapshot<TValue extends Json>(key: string) {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const db = await openDatabase();
  const snapshot = await getRecord<CachedSnapshot<TValue>>(db, SNAPSHOT_STORE, key);

  if (!snapshot) {
    return null;
  }

  if (snapshot.expiresAt && new Date(snapshot.expiresAt).getTime() < Date.now()) {
    await deleteRecord(db, SNAPSHOT_STORE, key);
    return null;
  }

  return snapshot;
}

export async function saveDraft<TValue extends Json>(key: string, value: TValue) {
  const db = await openDatabase();
  await putRecord(db, DRAFT_STORE, { key, value, updatedAt: new Date().toISOString() });
}

export async function deleteDraft(key: string) {
  if (!isIndexedDbAvailable()) {
    return;
  }

  const db = await openDatabase();
  await deleteRecord(db, DRAFT_STORE, key);
}

export async function getDraft<TValue extends Json>(key: string) {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const db = await openDatabase();
  return getRecord<{ key: string; value: TValue; updatedAt: string }>(db, DRAFT_STORE, key);
}

export async function trackPwaEvent(eventType: PwaMetricEvent["eventType"], metadata: Json = {}) {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const event: PwaMetricEvent = {
    id: createId(),
    eventType,
    route: window.location.pathname,
    metadata,
    createdAt: new Date().toISOString()
  };

  const db = await openDatabase();
  await putRecord(db, METRIC_STORE, event);

  if (navigator.onLine) {
    fetch("/api/pwa/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true
    }).catch(() => undefined);
  }

  return event;
}

export async function subscribeToPushNotifications(vapidPublicKey?: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
    return { ok: false, reason: "Push notifications are not configured for this device." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Push notification permission was not granted." };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });

  const response = await fetch("/api/pwa/push-subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(normalizePushSubscription(subscription))
  });

  if (!response.ok) {
    return { ok: false, reason: "Push subscription could not be saved." };
  }

  await trackPwaEvent("push_opt_in", { endpoint: hashEndpoint(subscription.endpoint) });
  return { ok: true, reason: "Push notifications are enabled." };
}

async function openDatabase() {
  if (!isIndexedDbAvailable()) {
    throw new Error("IndexedDB is not available in this browser.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const store = db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(METRIC_STORE)) {
        const store = db.createObjectStore(METRIC_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRecord<TValue>(db: IDBDatabase, storeName: string, value: TValue) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function deleteRecord(db: IDBDatabase, storeName: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function getRecord<TValue>(db: IDBDatabase, storeName: string, key: string) {
  return new Promise<TValue | null>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as TValue | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function readAll<TValue>(db: IDBDatabase, storeName: string) {
  return new Promise<TValue[]>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as TValue[]);
    request.onerror = () => reject(request.error);
  });
}

async function registerBackgroundSync() {
  const registration = await navigator.serviceWorker?.ready.catch(() => null);
  const syncManager = (registration as SyncCapableRegistration | null)?.sync;

  if (syncManager) {
    await syncManager.register("apex-offline-sync").catch(() => undefined);
  }
}

async function postToServiceWorker(message: { type: string; payload: QueuedOfflineAction }) {
  const registration = await navigator.serviceWorker?.ready.catch(() => null);
  registration?.active?.postMessage(message);
}

function normalizePushSubscription(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? ""
    }
  };
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function getProcessedIds(body: unknown) {
  if (!body || typeof body !== "object" || !("processedIds" in body) || !Array.isArray(body.processedIds)) {
    return [];
  }

  return body.processedIds.filter((id): id is string => typeof id === "string");
}

function createId() {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hashEndpoint(endpoint: string) {
  return endpoint.slice(0, 16);
}
