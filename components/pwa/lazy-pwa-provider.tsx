"use client";

import { useEffect, useState, type ComponentType } from "react";

type PwaProviderComponent = ComponentType;
type IdleCapableWindow = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

const SW_RELOAD_KEY = "apex:sw-refresh-reloaded";

export function LazyPwaProvider() {
  const [Provider, setProvider] = useState<PwaProviderComponent | null>(null);
  const enablePwa = process.env.NODE_ENV === "production";

  useEffect(() => {
    if (enablePwa) {
      return;
    }

    navigator.serviceWorker?.getRegistrations()
      .then((registrations) => {
        registrations
          .filter((registration) => registration.active?.scriptURL.includes("/sw.js"))
          .forEach((registration) => { registration.unregister().catch(() => undefined); });
      })
      .catch(() => undefined);

    caches?.keys()
      .then((keys) => {
        keys
          .filter((key) => key.startsWith("apex-pwa-"))
          .forEach((key) => { caches.delete(key).catch(() => undefined); });
      })
      .catch(() => undefined);
  }, [enablePwa]);

  useEffect(() => {
    if (!enablePwa || !("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;

    const activateWaitingWorker = (worker: ServiceWorker | null) => {
      worker?.postMessage({ type: "SKIP_WAITING" });
    };

    const handleControllerChange = () => {
      if (refreshing || sessionStorage.getItem(SW_RELOAD_KEY)) {
        return;
      }

      refreshing = true;
      sessionStorage.setItem(SW_RELOAD_KEY, "true");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registration) => {
        activateWaitingWorker(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) {
            return;
          }

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              activateWaitingWorker(worker);
            }
          });
        });

        return registration.update();
      })
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [enablePwa]);

  useEffect(() => {
    if (!enablePwa) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const idleWindow = window as IdleCapableWindow;

    const loadProvider = () => {
      import("./pwa-provider")
        .then((module) => {
          if (!cancelled) {
            setProvider(() => module.PwaProvider);
          }
        })
        .catch(() => undefined);
    };

    timeoutId = globalThis.setTimeout(() => {
      timeoutId = null;

      if (typeof idleWindow.requestIdleCallback === "function") {
        idleId = idleWindow.requestIdleCallback(loadProvider, { timeout: 4000 });
        return;
      }

      loadProvider();
    }, 8000);

    return () => {
      cancelled = true;
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [enablePwa]);

  return enablePwa && Provider ? <Provider /> : null;
}
