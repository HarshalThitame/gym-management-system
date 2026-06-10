"use client";

import { Bell, Download, RefreshCw, ShieldCheck, Smartphone, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { flushOfflineActions, getQueuedOfflineActions, subscribeToPushNotifications } from "@/features/pwa/lib/offline-store";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;

export function MobileReadinessPanel() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = async () => {
      setIsOnline(navigator.onLine);
      const actions = await getQueuedOfflineActions().catch(() => []);
      setQueuedCount(actions.length);
    };

    const handleOnline = async () => {
      await flushOfflineActions().catch(() => undefined);
      await refresh();
    };

    refresh();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", refresh);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return (
    <Card className="overflow-hidden border-primary/10 bg-obsidian text-white">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Mobile app mode</p>
            <h2 className="mt-2 text-2xl font-black">Ready for workouts on the move</h2>
          </div>
          <Badge variant={isOnline ? "success" : "warning"}>{isOnline ? "Online" : "Offline"}</Badge>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-white/68">
          Apex can be installed, cache previously viewed portal screens, queue approved mobile actions, and recover automatically on slow or dropped networks.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-4">
          <StatusTile icon="install" label="Install" value="Home screen" />
          <StatusTile icon={isOnline ? "online" : "offline"} label="Network" value={isOnline ? "Connected" : "Offline mode"} />
          <StatusTile icon="sync" label="Sync queue" value={`${queuedCount} pending`} />
          <StatusTile icon="privacy" label="Privacy" value="Local-first drafts" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              const result = await flushOfflineActions().catch(() => ({ synced: 0 }));
              setQueuedCount(0);
              setMessage(result.synced > 0 ? `${result.synced} offline actions synced.` : "No offline actions are waiting.");
            }}
            size="sm"
            type="button"
            variant="accent"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Sync now
          </Button>
          {VAPID_PUBLIC_KEY ? (
            <Button
              onClick={async () => {
                const result = await subscribeToPushNotifications(VAPID_PUBLIC_KEY).catch(() => ({ ok: false, reason: "Push setup failed." }));
                setMessage(result.reason);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Bell aria-hidden="true" className="size-4" />
              Enable push
            </Button>
          ) : null}
          <Button onClick={() => setMessage("Use the browser install option to add Apex to your home screen.")} size="sm" type="button" variant="outline">
            <Download aria-hidden="true" className="size-4" />
            Install help
          </Button>
        </div>
        {message ? <p className="mt-3 text-xs font-semibold text-white/68">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

type StatusTileProps = {
  icon: "install" | "online" | "offline" | "sync" | "privacy";
  label: string;
  value: string;
};

function StatusTile({ icon, label, value }: StatusTileProps) {
  const Icon = getStatusIcon(icon);

  return (
    <div className="rounded-md border border-white/12 bg-white/8 p-4">
      <Icon aria-hidden="true" className="size-5 text-accent" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function getStatusIcon(icon: StatusTileProps["icon"]) {
  if (icon === "online") {
    return Wifi;
  }

  if (icon === "offline") {
    return WifiOff;
  }

  if (icon === "sync") {
    return RefreshCw;
  }

  if (icon === "privacy") {
    return ShieldCheck;
  }

  return Smartphone;
}
