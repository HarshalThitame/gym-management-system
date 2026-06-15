import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { Notification } from "@/types";

export const memberNotificationService = {
  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    const cacheKey = offlineCache.memberKey(userId, `notifications:${limit}`);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      const notifications = (data ?? []) as Notification[];
      await offlineCache.set(cacheKey, notifications, { ttlMs: 2 * 60 * 1000 });
      return notifications;
    } catch {
      const cached = await offlineCache.get<Notification[]>(cacheKey);
      if (cached) return cached.data;
      return [];
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    return count ?? 0;
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      return !error;
    } catch {
      return false;
    }
  },

  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      return !error;
    } catch {
      return false;
    }
  },

  async getUnreadCountCached(userId: string): Promise<number> {
    const cacheKey = offlineCache.memberKey(userId, "unread_count");
    const cached = await offlineCache.get<number>(cacheKey);
    if (cached && !cached.stale) return cached.data;

    const count = await this.getUnreadCount(userId);
    await offlineCache.set(cacheKey, count, { ttlMs: 60 * 1000 });
    return count;
  },
};
