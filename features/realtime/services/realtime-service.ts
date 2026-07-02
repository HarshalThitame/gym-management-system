import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RealtimeSubscription = {
  id: string;
  user_id: string;
  channel: string;
  event_type: string;
  filters: Record<string, any>;
  is_active: boolean;
  created_at: string;
  last_seen_at: string;
};

export type RealtimeEvent = {
  id: string;
  channel: string;
  event_type: string;
  payload: Record<string, any>;
  created_at: string;
};

export type RealtimeChannel =
  | "members"
  | "attendance"
  | "payments"
  | "notifications"
  | "leads"
  | "equipment"
  | "classes";

export type RealtimeEventType =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "check_in"
  | "check_out";

/**
 * Publish a real-time event to a channel
 */
export async function publishRealtimeEvent(
  channel: RealtimeChannel,
  eventType: RealtimeEventType,
  payload: Record<string, any>
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("publish_realtime_event", {
    p_channel: channel,
    p_event_type: eventType,
    p_payload: payload,
  });

  if (error) {
    console.error("[Realtime] Failed to publish event:", error);
    throw error;
  }

  return data;
}

/**
 * Subscribe a user to a real-time channel
 */
export async function subscribeToChannel(
  userId: string,
  channel: RealtimeChannel,
  eventType: RealtimeEventType,
  filters: Record<string, any> = {}
): Promise<RealtimeSubscription> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("realtime_subscriptions")
    .insert({
      user_id: userId,
      channel,
      event_type: eventType,
      filters,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[Realtime] Failed to create subscription:", error);
    throw error;
  }

  return data;
}

/**
 * Unsubscribe a user from a channel
 */
export async function unsubscribeFromChannel(
  subscriptionId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("realtime_subscriptions")
    .update({ is_active: false })
    .eq("id", subscriptionId);

  if (error) {
    console.error("[Realtime] Failed to unsubscribe:", error);
    throw error;
  }
}

/**
 * Get user's active subscriptions
 */
export async function getUserSubscriptions(
  userId: string
): Promise<RealtimeSubscription[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("realtime_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Realtime] Failed to get subscriptions:", error);
    return [];
  }

  return data || [];
}

/**
 * Get recent events for a channel
 */
export async function getRecentEvents(
  channel: RealtimeChannel,
  limit: number = 50
): Promise<RealtimeEvent[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("realtime_events")
    .select("*")
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Realtime] Failed to get events:", error);
    return [];
  }

  return data || [];
}

/**
 * Clean up old events (older than 24 hours)
 */
export async function cleanupOldEvents(): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("cleanup_old_realtime_events");

  if (error) {
    console.error("[Realtime] Failed to cleanup events:", error);
    return 0;
  }

  return data || 0;
}

/**
 * Publish member check-in event
 */
export async function publishMemberCheckIn(
  memberId: string,
  gymId: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  return publishRealtimeEvent("attendance", "check_in", {
    member_id: memberId,
    gym_id: gymId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Publish member check-out event
 */
export async function publishMemberCheckOut(
  memberId: string,
  gymId: string,
  duration: number,
  metadata: Record<string, any> = {}
): Promise<string> {
  return publishRealtimeEvent("attendance", "check_out", {
    member_id: memberId,
    gym_id: gymId,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Publish payment received event
 */
export async function publishPaymentReceived(
  paymentId: string,
  memberId: string,
  amount: number,
  metadata: Record<string, any> = {}
): Promise<string> {
  return publishRealtimeEvent("payments", "created", {
    payment_id: paymentId,
    member_id: memberId,
    amount,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Publish notification event
 */
export async function publishNotification(
  userId: string,
  title: string,
  message: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  return publishRealtimeEvent("notifications", "created", {
    user_id: userId,
    title,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Publish lead status change event
 */
export async function publishLeadStatusChange(
  leadId: string,
  oldStatus: string,
  newStatus: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  return publishRealtimeEvent("leads", "status_changed", {
    lead_id: leadId,
    old_status: oldStatus,
    new_status: newStatus,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}
