"use client";

import { Bell, Download, RefreshCw, Smartphone, Wifi, WifiOff, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { flushOfflineActions, getQueuedOfflineActions, subscribeToPushNotifications, trackPwaEvent } from "@/features/pwa/lib/offline-store";
import { getInstallPlatform, getNetworkStatusMessage, shouldShowInstallPrompt, type InstallPlatform } from "@/features/pwa/lib/business-rules";

const INSTALL_DISMISSED_KEY = "apex:pwa-install-dismissed-at";
const STANDALONE_TRACKED_KEY = "apex:pwa-standalone-open-tracked";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

export function PwaProvider() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [queuedActions, setQueuedActions] = useState(0);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissedAt, setInstallDismissedAt] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [hideNetworkBanner, setHideNetworkBanner] = useState(false);

  const platform = useMemo<InstallPlatform>(() => {
    if (typeof navigator === "undefined") {
      return "unsupported";
    }

    return getInstallPlatform(navigator.userAgent, "standalone" in navigator);
  }, []);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches;
  }, []);

  const daysSinceDismissed = useMemo(() => {
    if (!installDismissedAt) {
      return undefined;
    }

    const date = new Date(installDismissedAt);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return Math.floor((Date.now() - date.getTime()) / 86_400_000);
  }, [installDismissedAt]);

  const showInstallPrompt = (platform === "ios" || installEvent !== null) && shouldShowInstallPrompt({
    isStandalone,
    platform,
    hasDismissedPrompt: Boolean(installDismissedAt),
    ...(daysSinceDismissed === undefined ? {} : { daysSinceDismissed })
  });

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setInstallDismissedAt(localStorage.getItem(INSTALL_DISMISSED_KEY));

    const refreshQueuedCount = async () => {
      const actions = await getQueuedOfflineActions().catch(() => []);
      setQueuedActions(actions.length);
    };

    const handleOnline = async () => {
      setIsOnline(true);
      setHideNetworkBanner(false);
      await flushOfflineActions().catch(() => undefined);
      await refreshQueuedCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setHideNetworkBanner(false);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      // Save the event for later use via custom install button
      setInstallEvent(event as BeforeInstallPromptEvent);
      trackPwaEvent("install_prompt_shown", { platform }).catch(() => undefined);
    };

    const handleAppInstalled = () => {
      setInstallEvent(null);
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
      setInstallDismissedAt(null);
      trackPwaEvent("install_accepted", { platform }).catch(() => undefined);
    };

    refreshQueuedCount();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [platform]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let registrationRef: ServiceWorkerRegistration | null = null;

    const registerServiceWorker = async () => {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      registrationRef = registration;

      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setHasUpdate(true);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) {
          return;
        }

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(worker);
            setHasUpdate(true);
          }
        });
      });
    };

    registerServiceWorker().catch(() => undefined);

    return () => {
      registrationRef?.update().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!isStandalone || sessionStorage.getItem(STANDALONE_TRACKED_KEY)) {
      return;
    }

    sessionStorage.setItem(STANDALONE_TRACKED_KEY, "true");
    trackPwaEvent("standalone_open", { pathname }).catch(() => undefined);
  }, [isStandalone, pathname]);

  const networkMessage = getNetworkStatusMessage(isOnline, queuedActions);

  return (
    <>
      {!hideNetworkBanner && (!isOnline || queuedActions > 0) ? (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-xl rounded-lg border border-border bg-surface p-3 shadow-premium">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted">
              {isOnline ? <Wifi aria-hidden="true" className="size-5 text-success" /> : <WifiOff aria-hidden="true" className="size-5 text-warning" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{isOnline ? "Connection restored" : "Offline mode active"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{networkMessage}</p>
            </div>
            <button
              aria-label="Dismiss network status"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              onClick={() => setHideNetworkBanner(true)}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {hasUpdate ? (
        <Card className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 mx-auto max-w-md p-4 shadow-premium lg:bottom-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <RefreshCw aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Apex has an update</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Refresh now to load the latest offline cache and mobile improvements.</p>
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() => {
                    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  }}
                  size="sm"
                  type="button"
                  variant="accent"
                >
                  Update
                </Button>
                <Button onClick={() => setHasUpdate(false)} size="sm" type="button" variant="ghost">
                  Later
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {showInstallPrompt ? (
        <Card className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 mx-auto max-w-md p-4 shadow-premium lg:left-auto lg:right-5 lg:bottom-5 lg:mx-0">
          <div className="flex items-start gap-3">
            <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Smartphone aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black">Install Apex</p>
                <Badge variant="premium">PWA</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{getInstallCopy(platform)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {installEvent ? (
                  <Button onClick={() => promptInstall(installEvent, platform, setInstallEvent, setInstallDismissedAt)} size="sm" type="button" variant="accent">
                    <Download aria-hidden="true" className="size-4" />
                    Install
                  </Button>
                ) : null}
                {VAPID_PUBLIC_KEY ? (
                  <Button
                    onClick={async () => {
                      const result = await subscribeToPushNotifications(VAPID_PUBLIC_KEY).catch(() => ({ ok: false, reason: "Push setup failed." }));
                      setPushMessage(result.reason);
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Bell aria-hidden="true" className="size-4" />
                    Push
                  </Button>
                ) : null}
                <Button onClick={() => dismissInstallPrompt(setInstallDismissedAt)} size="sm" type="button" variant="ghost">
                  Not now
                </Button>
              </div>
              {pushMessage ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{pushMessage}</p> : null}
            </div>
          </div>
        </Card>
      ) : null}
    </>
  );
}

async function promptInstall(
  installEvent: BeforeInstallPromptEvent,
  platform: InstallPlatform,
  setInstallEvent: (event: BeforeInstallPromptEvent | null) => void,
  setInstallDismissedAt: (value: string | null) => void
) {
  await installEvent.prompt();
  const choice = await installEvent.userChoice;

  if (choice.outcome === "dismissed") {
    dismissInstallPrompt(setInstallDismissedAt);
    await trackPwaEvent("install_dismissed", { platform, choicePlatform: choice.platform }).catch(() => undefined);
  }

  setInstallEvent(null);
}

function dismissInstallPrompt(setInstallDismissedAt: (value: string | null) => void) {
  const dismissedAt = new Date().toISOString();
  localStorage.setItem(INSTALL_DISMISSED_KEY, dismissedAt);
  setInstallDismissedAt(dismissedAt);
}

function getInstallCopy(platform: InstallPlatform) {
  if (platform === "ios") {
    return "On iPhone or iPad, use Share, then Add to Home Screen for a full-screen portal.";
  }

  if (platform === "android") {
    return "Add Apex to your home screen for one-tap check-ins, classes, and workout logs.";
  }

  return "Install Apex as a focused desktop app with offline-ready navigation.";
}
