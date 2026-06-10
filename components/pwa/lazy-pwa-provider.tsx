"use client";

import { useEffect, useState, type ComponentType } from "react";

type PwaProviderComponent = ComponentType;
type IdleCapableWindow = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

export function LazyPwaProvider() {
  const [Provider, setProvider] = useState<PwaProviderComponent | null>(null);

  useEffect(() => {
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
  }, []);

  return Provider ? <Provider /> : null;
}
