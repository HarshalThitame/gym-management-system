import { useEffect, useRef, useCallback } from "react";
import { getSupabaseClient } from "@/api/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeCallback<T = unknown> = (payload: T) => void;

interface SubscriptionConfig {
  table: string;
  schema?: string;
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
}

export function useRealtimeSubscription<T = unknown>(
  config: SubscriptionConfig,
  callback: RealtimeCallback<T>,
  enabled = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const setupSubscription = useCallback(() => {
    if (!enabled) return;

    const supabase = getSupabaseClient();
    const channelName = `${config.table}-${config.filter ?? "all"}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        {
          event: config.event ?? "*",
          schema: config.schema ?? "public",
          table: config.table,
          filter: config.filter,
        },
        (payload: any) => {
          callbackRef.current(payload as T);
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [config.table, config.schema, config.filter, config.event, enabled]);

  useEffect(() => {
    setupSubscription();
    return () => {
      if (channelRef.current) {
        const supabase = getSupabaseClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupSubscription]);

  return {
    unsubscribe: () => {
      if (channelRef.current) {
        const supabase = getSupabaseClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    },
  };
}

export function useMemberAttendanceRealtime(memberId: string, callback: () => void) {
  return useRealtimeSubscription(
    { table: "attendance_sessions", filter: `member_id=eq.${memberId}` },
    callback,
    !!memberId
  );
}

export function useMemberMembershipRealtime(memberId: string, callback: () => void) {
  return useRealtimeSubscription(
    { table: "memberships", filter: `member_id=eq.${memberId}` },
    callback,
    !!memberId
  );
}

export function useNotificationRealtime(userId: string, callback: () => void) {
  return useRealtimeSubscription(
    { table: "notifications", filter: `user_id=eq.${userId}` },
    callback,
    !!userId
  );
}
