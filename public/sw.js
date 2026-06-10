const APP_VERSION = "apex-pwa-v17-20260610";
const STATIC_CACHE = `${APP_VERSION}-static`;
const RUNTIME_CACHE = `${APP_VERSION}-runtime`;
const OFFLINE_URL = "/offline";
const DB_NAME = "apex-pwa-store";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";

const APP_SHELL_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/apex-icon.svg",
  "/icons/apex-maskable.svg",
  "/icons/apple-touch-icon.svg",
  "/icons/shortcut-check-in.svg",
  "/icons/shortcut-classes.svg",
  "/icons/shortcut-workout.svg"
];

const PROTECTED_ROUTE_PREFIXES = ["/admin", "/member", "/trainer", "/auth", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("apex-pwa-") && !key.startsWith(APP_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "QUEUE_OFFLINE_ACTION" && event.data.payload) {
    event.waitUntil(queueOfflineAction(event.data.payload));
  }

  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(clearPrivateCaches());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkOnlyJson(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/screenshots/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "apex-offline-sync") {
    event.waitUntil(flushOfflineActions());
  }
});

self.addEventListener("push", (event) => {
  const payload = safeJson(event.data?.text()) ?? {};
  const title = typeof payload.title === "string" ? payload.title : "Apex update";
  const body = typeof payload.body === "string" ? payload.body : "Open Apex to view the latest update.";
  const url = typeof payload.url === "string" ? payload.url : "/member/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/apex-icon.svg",
      badge: "/icons/shortcut-check-in.svg",
      data: { url },
      tag: typeof payload.tag === "string" ? payload.tag : "apex-notification",
      renotify: false
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/member/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

async function handleNavigation(request, url) {
  if (isProtectedRoute(url.pathname)) {
    try {
      return await fetch(request);
    } catch {
      return caches.match(OFFLINE_URL);
    }
  }

  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

async function networkOnlyJson(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: { code: "OFFLINE", message: "This request is not available offline." } }), {
      status: 503,
      headers: { "content-type": "application/json" }
    });
  }
}

async function clearPrivateCaches() {
  await caches.delete(RUNTIME_CACHE);
}

function isProtectedRoute(pathname) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || network || caches.match(OFFLINE_URL);
}

function safeJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueOfflineAction(action) {
  const db = await openDatabase();
  const record = {
    ...action,
    id: action.id || crypto.randomUUID(),
    createdAt: action.createdAt || new Date().toISOString()
  };

  await transactionDone(db, OUTBOX_STORE, "readwrite", (store) => {
    store.put(record);
  });

  if ("sync" in self.registration) {
    await self.registration.sync.register("apex-offline-sync");
  }
}

async function flushOfflineActions() {
  const db = await openDatabase();
  const records = await readAll(db, OUTBOX_STORE);

  if (records.length === 0) {
    return;
  }

  const response = await fetch("/api/pwa/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actions: records })
  });

  if (!response.ok) {
    throw new Error("Offline sync failed.");
  }

  await transactionDone(db, OUTBOX_STORE, "readwrite", (store) => {
    records.forEach((record) => store.delete(record.id));
  });
}

function readAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(db, storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    callback(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
