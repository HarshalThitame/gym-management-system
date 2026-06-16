"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  PlusCircle,
  Shield,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RecentEvent = {
  id: string;
  organization_id: string;
  event_type: string;
  reason: string | null;
  created_at: string;
};

export function SubscriptionRecentEvents({ events }: { events: RecentEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-black sm:text-2xl">Recent Subscription Events</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center" role="status">
            <Clock className="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-bold text-muted-foreground">No subscription events recorded yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Events will appear here as subscription lifecycle actions occur.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black sm:text-2xl">Recent Subscription Events</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Latest {events.length} global subscription lifecycle events
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1" role="list" aria-label="Subscription events">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EventRow({ event }: { event: RecentEvent }) {
  const { Icon, bgClass } = getEventMeta(event.event_type);
  const label = formatEventLabel(event.event_type);

  return (
    <div className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-surface-muted/50 transition-colors" role="listitem">
      <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", bgClass)} aria-hidden="true">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{label}</p>
        {event.reason && (
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{event.reason}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground/60 sm:hidden">
          <TimeLabel iso={event.created_at} />
        </p>
      </div>
      <time
        dateTime={event.created_at}
        className="hidden shrink-0 text-xs font-semibold text-muted-foreground sm:block"
        title={new Date(event.created_at).toLocaleString("en-IN")}
      >
        <TimeLabel iso={event.created_at} />
      </time>
    </div>
  );
}

function TimeLabel({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setNow(Date.now()); }, []);
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (Number.isNaN(diffMs)) return <>Unknown</>;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return <>{seconds}s ago</>;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return <>{minutes}m ago</>;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return <>{hours}h ago</>;
  const days = Math.floor(hours / 24);
  if (days < 30) return <>{days}d ago</>;
  const months = Math.floor(days / 30);
  return <>{months}mo ago</>;
}

function getEventMeta(eventType: string): { Icon: typeof Clock; bgClass: string } {
  if (eventType.includes("created") || eventType.includes("started"))
    return { Icon: PlusCircle, bgClass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" };
  if (eventType.includes("cancelled") || eventType.includes("expired"))
    return { Icon: XCircle, bgClass: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" };
  if (eventType.includes("suspended") || eventType.includes("failed"))
    return { Icon: AlertCircle, bgClass: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" };
  if (eventType.includes("converted") || eventType.includes("renewed") || eventType.includes("recovered"))
    return { Icon: CheckCircle2, bgClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" };
  if (eventType.includes("upgraded") || eventType.includes("downgraded"))
    return { Icon: eventType.includes("up") ? ArrowUp : ArrowDown, bgClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" };
  if (eventType.includes("addon"))
    return { Icon: PlusCircle, bgClass: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" };
  if (eventType.includes("dunning"))
    return { Icon: Shield, bgClass: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" };
  if (eventType.includes("trial"))
    return { Icon: Zap, bgClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300" };
  return { Icon: Clock, bgClass: "bg-surface-muted text-muted-foreground" };
}

function formatEventLabel(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
