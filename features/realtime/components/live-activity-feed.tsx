"use client";

import { useRealtime } from "../hooks/use-realtime";
import { RealtimeStatus } from "./realtime-status";
import type { RealtimeChannel } from "../services/realtime-service";
import { cn } from "@/lib/utils";
import { Activity, User, CreditCard, Bell, TrendingUp, Dumbbell } from "lucide-react";

type LiveActivityFeedProps = {
  channel: RealtimeChannel;
  maxItems?: number;
  className?: string;
  title?: string;
};

/**
 * Live activity feed component that displays real-time events
 */
export function LiveActivityFeed({
  channel,
  maxItems = 10,
  className,
  title = "Live Activity",
}: LiveActivityFeedProps) {
  const { events, isConnected } = useRealtime({ channel });

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "check_in":
      case "check_out":
        return <User className="h-4 w-4" />;
      case "created":
        if (channel === "payments") return <CreditCard className="h-4 w-4" />;
        if (channel === "notifications") return <Bell className="h-4 w-4" />;
        return <Activity className="h-4 w-4" />;
      case "updated":
        return <TrendingUp className="h-4 w-4" />;
      case "status_changed":
        return <Dumbbell className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "check_in":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "check_out":
        return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20";
      case "created":
        return "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20";
      case "updated":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
      case "status_changed":
        return "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20";
    }
  };

  const formatEventMessage = (event: any) => {
    const payload = event.payload;
    
    switch (event.event_type) {
      case "check_in":
        return `Member checked in`;
      case "check_out":
        return `Member checked out${payload.duration ? ` (${Math.round(payload.duration / 60)} min)` : ""}`;
      case "created":
        if (channel === "payments") return `Payment received: $${payload.amount}`;
        if (channel === "notifications") return payload.title || "New notification";
        return "New item created";
      case "updated":
        return "Item updated";
      case "status_changed":
        return `Status changed: ${payload.old_status} → ${payload.new_status}`;
      default:
        return "Activity occurred";
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        <RealtimeStatus isConnected={isConnected} />
      </div>
      <div className="divide-y">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Waiting for activity...
          </div>
        ) : (
          events.slice(0, maxItems).map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  getEventColor(event.event_type)
                )}
              >
                {getEventIcon(event.event_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{formatEventMessage(event)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatTime(event.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
