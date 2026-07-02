import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishRealtimeEvent } from "@/features/realtime/services/realtime-service";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  category: string;
  metadata: Record<string, any>;
  read_at: string | null;
  action_url: string | null;
  created_at: string;
};

export type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  category?: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
};

/**
 * Create a notification
 */
export async function createNotification(input: NotificationInput): Promise<Notification> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("notifications")
    .insert({
      user_id: input.userId,
      title: input.title,
      message: input.message,
      type: input.type || "info",
      category: input.category || "general",
      metadata: input.metadata || {},
      action_url: input.actionUrl || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[Notification] Failed to create notification:", error);
    throw error;
  }

  // Publish real-time event
  await publishRealtimeEvent("notifications", "created", {
    notification_id: data.id,
    user_id: data.user_id,
    title: data.title,
    message: data.message,
    type: data.type,
  });

  return data;
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Notification] Failed to get notifications:", error);
    return [];
  }

  return data || [];
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  const { data, error } = await supabase.rpc("get_unread_notification_count", {
    p_user_id: user.id,
  });

  if (error) {
    console.error("[Notification] Failed to get unread count:", error);
    return 0;
  }

  return data || 0;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[Notification] Failed to mark as read:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("[Notification] Failed to mark all as read:", error);
    throw error;
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[Notification] Failed to delete notification:", error);
    throw error;
  }
}

/**
 * Send notification to multiple users
 */
export async function broadcastNotification(
  userIds: string[],
  input: Omit<NotificationInput, "userId">
): Promise<void> {
  const adminClient = createAdminClient();

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    title: input.title,
    message: input.message,
    type: input.type || "info",
    category: input.category || "general",
    metadata: input.metadata || {},
    action_url: input.actionUrl || null,
  }));

  const { error } = await adminClient.from("notifications").insert(notifications);

  if (error) {
    console.error("[Notification] Failed to broadcast notification:", error);
    throw error;
  }

  // Publish real-time events for each user
  for (const userId of userIds) {
    await publishRealtimeEvent("notifications", "created", {
      user_id: userId,
      title: input.title,
      message: input.message,
      type: input.type,
    });
  }
}

/**
 * Create member-related notification
 */
export async function notifyMemberAction(
  memberId: string,
  action: string,
  details?: Record<string, any>
): Promise<void> {
  const supabase = createClient();
  const adminClient = createAdminClient();

  // Get member's user_id
  const { data: member } = await adminClient
    .from("members")
    .select("user_id, full_name")
    .eq("id", memberId)
    .single();

  if (!member?.user_id) return;

  let title = "";
  let message = "";
  let type: "info" | "success" | "warning" | "error" = "info";

  switch (action) {
    case "membership_expiring":
      title = "Membership Expiring Soon";
      message = `Your membership is expiring in ${details?.days || 7} days. Renew now to continue enjoying our services.`;
      type = "warning";
      break;
    case "payment_received":
      title = "Payment Received";
      message = `We've received your payment of $${details?.amount || 0}. Thank you!`;
      type = "success";
      break;
    case "payment_failed":
      title = "Payment Failed";
      message = "Your payment could not be processed. Please update your payment method.";
      type = "error";
      break;
    case "class_reminder":
      title = "Class Reminder";
      message = `Don't forget about your ${details?.className || "upcoming"} class at ${details?.time || "the scheduled time"}.`;
      type = "info";
      break;
    default:
      title = "Notification";
      message = `Action: ${action}`;
  }

  await createNotification({
    userId: member.user_id,
    title,
    message,
    type,
    category: "member",
    metadata: { memberId, action, ...details },
  });
}
