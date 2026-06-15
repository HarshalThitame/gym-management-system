import { getSupabaseClient } from "@/api/supabase";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "cancelled";
export type CampaignAudience = "members" | "trainers" | "staff" | "admins" | "leads" | "all";

export interface Campaign {
  id: string; organization_id: string; gym_id: string | null; name: string;
  channel: "push" | "email" | "sms" | "whatsapp";
  audience: CampaignAudience; template_id: string | null;
  subject: string | null; body: string;
  scheduled_at: string | null; sent_at: string | null;
  status: CampaignStatus; total_recipients: number; sent_count: number;
  opened_count: number; clicked_count: number; failed_count: number;
  created_by: string | null; created_at: string; updated_at: string;
}

export const commCampaignService = {
  async createCampaign(data: Omit<Campaign, "id" | "sent_at" | "sent_count" | "opened_count" | "clicked_count" | "failed_count" | "created_at" | "updated_at">): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data: result, error } = await supabase.from("comm_campaigns").insert(data).select("id").maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: result?.id };
    } catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Failed" }; }
  },

  async getCampaigns(orgId: string): Promise<Campaign[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("comm_campaigns").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50);
    return (data ?? []) as Campaign[];
  },

  async sendCampaign(campaignId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data: campaign } = await supabase.from("comm_campaigns").select("*").eq("id", campaignId).maybeSingle();
      if (!campaign) return false;

      const audienceQuery = this.getAudienceQuery(campaign as Campaign);

      await supabase.from("comm_campaigns").update({ status: "sending", sent_at: new Date().toISOString() }).eq("id", campaignId);

      const batchSize = 100;
      for (let i = 0; i < audienceQuery.length; i += batchSize) {
        const batch = audienceQuery.slice(i, i + batchSize);
        const notifications = batch.map((userId: string) => ({
          user_id: userId,
          organization_id: (campaign as any).organization_id,
          title: (campaign as any).subject ?? (campaign as any).name,
          body: (campaign as any).body,
          type: "campaign",
          priority: "normal",
          metadata: { campaign_id: campaignId, channel: (campaign as any).channel },
        }));
        await supabase.from("notifications").insert(notifications);
      }

      await supabase.from("comm_campaigns").update({
        status: "completed",
        sent_count: audienceQuery.length,
      }).eq("id", campaignId);

      return true;
    } catch { return false; }
  },

  async getAudienceQuery(campaign: Campaign): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      const orgId = campaign.organization_id;
      const gymScope = campaign.gym_id ? (q: any) => q.eq("gym_id", campaign.gym_id) : (q: any) => q;

      switch (campaign.audience) {
        case "members": {
          const { data } = await gymScope(supabase.from("members").select("user_id").eq("organization_id", orgId).not("user_id", "is", null)).limit(5000);
          return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
        }
        case "trainers": {
          const { data } = await supabase.from("trainers").select("user_id").eq("organization_id", orgId).not("user_id", "is", null);
          return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
        }
        case "staff": {
          const { data } = await supabase.from("branch_users").select("user_id").eq("organization_id", orgId).neq("role_name", "member").neq("role_name", "trainer");
          return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
        }
        case "admins": {
          const { data } = await supabase.from("branch_users").select("user_id").eq("organization_id", orgId).in("role_name", ["gym_admin", "organization_owner"]);
          return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
        }
        case "leads": {
          const { data } = await gymScope(supabase.from("leads").select("assigned_to").eq("organization_id", orgId).not("assigned_to", "is", null));
          return (data ?? []).map((r: any) => r.assigned_to).filter(Boolean);
        }
        default: return [];
      }
    } catch { return []; }
  },
};
