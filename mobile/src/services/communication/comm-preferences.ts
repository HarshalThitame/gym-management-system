import { getSupabaseClient } from "@/api/supabase";

export interface NotificationPreferences {
  push_enabled: boolean; email_enabled: boolean; sms_enabled: boolean; whatsapp_enabled: boolean;
  marketing_enabled: boolean;
  categories: {
    attendance: boolean; membership: boolean; payment: boolean;
    lead: boolean; trainer: boolean; system: boolean; campaign: boolean;
  };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  push_enabled: true, email_enabled: true, sms_enabled: false, whatsapp_enabled: false,
  marketing_enabled: true,
  categories: { attendance: true, membership: true, payment: true, lead: true, trainer: true, system: true, campaign: true },
};

export const commPreferenceService = {
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
      if (data) return data as NotificationPreferences;
      await supabase.from("notification_preferences").insert({ user_id: userId, ...DEFAULT_PREFERENCES });
      return DEFAULT_PREFERENCES;
    } catch { return DEFAULT_PREFERENCES; }
  },

  async updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, ...prefs });
      return !error;
    } catch { return false; }
  },
};
