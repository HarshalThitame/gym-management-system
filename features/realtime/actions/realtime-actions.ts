"use server";

import { createClient } from "@/lib/supabase/server";
import {
  subscribeToChannel,
  unsubscribeFromChannel,
  getUserSubscriptions,
  getRecentEvents,
  publishRealtimeEvent,
  type RealtimeChannel,
  type RealtimeEventType,
} from "../services/realtime-service";

/**
 * Subscribe to a real-time channel
 */
export async function subscribeAction(
  channel: RealtimeChannel,
  eventType: RealtimeEventType,
  filters: Record<string, any> = {}
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return subscribeToChannel(user.id, channel, eventType, filters);
}

/**
 * Unsubscribe from a real-time channel
 */
export async function unsubscribeAction(subscriptionId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return unsubscribeFromChannel(subscriptionId);
}

/**
 * Get user's active subscriptions
 */
export async function getSubscriptionsAction() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  return getUserSubscriptions(user.id);
}

/**
 * Get recent events for a channel
 */
export async function getEventsAction(
  channel: RealtimeChannel,
  limit: number = 50
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  return getRecentEvents(channel, limit);
}

/**
 * Publish a real-time event (admin only)
 */
export async function publishEventAction(
  channel: RealtimeChannel,
  eventType: RealtimeEventType,
  payload: Record<string, any>
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // TODO: Add role check for admin only

  return publishRealtimeEvent(channel, eventType, payload);
}
