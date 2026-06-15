import { getSupabaseClient } from "@/api/supabase";

export type AnnouncementAudience = "all_members" | "active_members" | "trainers" | "staff" | "gym_admins" | "all";
export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";
export type AnnouncementStatus = "draft" | "published" | "archived";

export interface Announcement {
  id: string; organization_id: string; gym_id: string | null; branch_id: string | null;
  title: string; body: string; audience: AnnouncementAudience;
  priority: AnnouncementPriority; status: AnnouncementStatus;
  publish_at: string | null; expires_at: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}

export const commAnnouncementService = {
  async create(data: Omit<Announcement, "id" | "created_at" | "updated_at">): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data: result, error } = await supabase.from("announcements").insert(data).select("id").maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: result?.id };
    } catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Failed" }; }
  },

  async getAnnouncements(orgId: string, gymId?: string): Promise<Announcement[]> {
    const supabase = getSupabaseClient();
    let q = supabase.from("announcements").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    if (gymId) q = q.eq("gym_id", gymId);
    const { data } = await q.limit(50);
    return (data ?? []) as Announcement[];
  },

  async publish(id: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data: ann } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
      if (!ann) return false;
      await supabase.from("announcements").update({ status: "published", publish_at: new Date().toISOString() }).eq("id", id);
      const a = ann as Announcement;
      const audienceQuery = await this.getAudienceUserIds(a.organization_id, a.gym_id, a.audience);
      const notifications = audienceQuery.map((uid: string) => ({
        user_id: uid, organization_id: a.organization_id,
        title: a.title, body: a.body, type: "announcement", priority: a.priority,
      }));
      if (notifications.length > 0) { await supabase.from("notifications").insert(notifications); }
      return true;
    } catch { return false; }
  },

  async getAudienceUserIds(orgId: string, gymId: string | null, audience: AnnouncementAudience): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      const gymScope = gymId ? (q: any) => q.eq("gym_id", gymId) : (q: any) => q;

      switch (audience) {
        case "all_members":
        case "active_members": {
          const st = audience === "active_members" ? "active" : undefined;
          let q = supabase.from("members").select("user_id").eq("organization_id", orgId).not("user_id", "is", null);
          if (st) q = q.eq("status", st);
          if (gymId) q = q.eq("gym_id", gymId);
          const { data } = await q.limit(5000);
          return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
        }
        case "trainers": {
          const { data } = await supabase.from("trainers").select("user_id").eq("organization_id", orgId).not("user_id", "is", null);
          return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
        }
        case "staff":
        case "gym_admins": {
          const roles = audience === "gym_admins" ? ["gym_admin", "organization_owner"] : ["gym_admin", "reception_staff", "organization_owner"];
          let q = supabase.from("branch_users").select("user_id").eq("organization_id", orgId).in("role_name", roles);
          if (gymId) q = q.eq("gym_id", gymId);
          const { data } = await q;
          return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
        }
        case "all": {
          const [members, staff] = await Promise.all([
            supabase.from("members").select("user_id").eq("organization_id", orgId).not("user_id", "is", null),
            supabase.from("branch_users").select("user_id").eq("organization_id", orgId),
          ]);
          return [...new Set([
            ...(members.data ?? []).map((r: any) => r.user_id),
            ...(staff.data ?? []).map((r: any) => r.user_id),
          ])].filter(Boolean);
        }
        default: return [];
      }
    } catch { return []; }
  },
};
