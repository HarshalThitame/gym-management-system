"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { useRealtimeSubscription } from "@/features/organization-owner/lib/use-realtime";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
};

type NotificationCenterProps = {
  organizationId: string;
};

export function NotificationCenter({ organizationId }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useRealtimeSubscription("security_events", { column: "organization_id", value: organizationId }, (event) => {
    if (event.eventType === "INSERT") {
      const newNotif: Notification = {
        id: `notif-${Date.now()}`,
        title: "New Security Event",
        body: (event.newData?.event_type as string) ?? "An event occurred",
        type: "warning",
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  });

  useRealtimeSubscription("activity_events", { column: "organization_id", value: organizationId }, (event) => {
    if (event.eventType === "INSERT") {
      const newNotif: Notification = {
        id: `notif-${Date.now()}`,
        title: formatEnterpriseLabel((event.newData?.event_type as string) ?? "activity"),
        body: (event.newData?.entity_type as string) ?? "",
        type: "info",
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={() => setOpen((p) => !p)}
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-surface shadow-premium md:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-black">Notifications</p>
            <div className="flex gap-1">
              {unreadCount > 0 ? (
                <button className="rounded-md p-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted" onClick={markAllRead} type="button" aria-label="Mark all read">
                  <CheckCheck className="size-4" />
                </button>
              ) : null}
              {notifications.length > 0 ? (
                <button className="rounded-md p-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted" onClick={clearAll} type="button" aria-label="Clear all">
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-muted ${n.read ? "opacity-60" : ""}`}
                  onClick={() => markRead(n.id)}
                  type="button"
                >
                  <div className={`mt-0.5 size-2 shrink-0 rounded-full ${n.type === "warning" ? "bg-amber-500" : n.type === "error" ? "bg-red-500" : "bg-accent"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read ? "font-semibold" : "font-black"}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  {!n.read ? <Check className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
