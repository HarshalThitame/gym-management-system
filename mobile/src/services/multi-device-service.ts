import { getSupabaseClient } from "@/api/supabase";
import { secureStorage } from "@/storage/secure";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "apex_device_id_v2";

export const multiDeviceService = {
  async getDeviceId(): Promise<string> {
    const stored = await secureStorage.get(DEVICE_ID_KEY as never);
    if (stored) return stored;
    const id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await secureStorage.set(DEVICE_ID_KEY as never, id);
    return id;
  },

  async registerDevice(userId: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const supabase = getSupabaseClient();
      await supabase.from("mobile_devices").upsert({
        user_id: userId,
        device_token: deviceId,
        platform: Platform.OS === "ios" ? "ios" : "android",
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "user_id, device_token" });
    } catch {}
  },

  async unregisterDevice(userId: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const supabase = getSupabaseClient();
      await supabase.from("mobile_devices").update({ is_active: false }).eq("user_id", userId).eq("device_token", deviceId);
    } catch {}
  },

  async getActiveSessions(userId: string): Promise<{ deviceToken: string; platform: string; lastSeen: string }[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("mobile_devices").select("device_token, platform, last_seen_at").eq("user_id", userId).eq("is_active", true);
      return (data ?? []).map((d: any) => ({ deviceToken: d.device_token, platform: d.platform, lastSeen: d.last_seen_at }));
    } catch { return []; }
  },

  async revokeOtherSessions(userId: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const supabase = getSupabaseClient();
      await supabase.from("mobile_devices").update({ is_active: false }).eq("user_id", userId).neq("device_token", deviceId);
    } catch {}
  },
};
