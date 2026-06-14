"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type RealtimeEvent = {
  id: string;
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  newData?: Record<string, unknown> | undefined;
  oldData?: Record<string, unknown> | undefined;
  timestamp: number;
};

export function useRealtimeSubscription(
  table: string,
  filter: { column: string; value: string },
  onEvent?: (event: RealtimeEvent) => void
) {
  const [latestEvent, setLatestEvent] = useState<RealtimeEvent | null>(null);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`realtime-${table}`)
      .on("postgres_changes" as never, {
        event: "*",
        schema: "public",
        table,
        filter: `${filter.column}=eq.${filter.value}`
      } as never, (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => {
        const event: RealtimeEvent = {
          id: `${payload.eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          table,
          eventType: payload.eventType,
          newData: payload.new ?? undefined,
          oldData: payload.old ?? undefined,
          timestamp: Date.now()
        };
        setLatestEvent(event);
        callbackRef.current?.(event);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter.column, filter.value]);

  return { latestEvent };
}

export function useDashboardRealtime(organizationId: string) {
  const [liveAttendance, setLiveAttendance] = useState(0);
  const [liveMembers, setLiveMembers] = useState(0);
  const [liveAlerts, setLiveAlerts] = useState(0);

  useRealtimeSubscription("attendance_logs", { column: "organization_id", value: organizationId }, (event) => {
    if (event.eventType === "INSERT") setLiveAttendance((prev) => prev + 1);
  });

  useRealtimeSubscription("members", { column: "gym_id", value: "not-used" }, (event) => {
    // For simplicity, we just track a generic "change" indicator
    if (event.eventType === "INSERT") setLiveMembers((prev) => prev + 1);
  });

  useRealtimeSubscription("security_events", { column: "organization_id", value: organizationId }, (event) => {
    if (event.eventType === "INSERT") setLiveAlerts((prev) => prev + 1);
  });

  return { liveAttendance, liveMembers, liveAlerts, resetAttendance: () => setLiveAttendance(0), resetMembers: () => setLiveMembers(0), resetAlerts: () => setLiveAlerts(0) };
}
