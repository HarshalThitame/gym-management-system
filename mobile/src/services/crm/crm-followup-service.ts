import { getSupabaseClient } from "@/api/supabase";
import { crmLeadService } from "./crm-lead-service";

export type FollowUpType = "call" | "whatsapp" | "email" | "meeting" | "trial" | "renewal" | "custom";
export type FollowUpStatus = "pending" | "completed" | "missed" | "cancelled";

export interface FollowUp {
  id: string;
  lead_id: string;
  type: FollowUpType;
  title: string;
  description: string | null;
  scheduled_at: string;
  completed_at: string | null;
  status: FollowUpStatus;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

export const crmFollowupService = {
  async createFollowUp(data: {
    lead_id: string;
    type: FollowUpType;
    title: string;
    description?: string;
    scheduled_at: string;
    assigned_to?: string;
  }): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data: result, error } = await supabase.from("lead_followups").insert({
        lead_id: data.lead_id,
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        scheduled_at: data.scheduled_at,
        status: "pending",
        assigned_to: data.assigned_to ?? null,
        created_at: new Date().toISOString(),
      }).select("id").maybeSingle();

      if (error) return { ok: false, error: error.message };
      return { ok: true, id: result?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed to create follow-up" };
    }
  },

  async completeFollowUp(followUpId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("lead_followups").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", followUpId);
      return !error;
    } catch { return false; }
  },

  async getFollowUpsForLead(leadId: string): Promise<FollowUp[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("lead_followups").select("*").eq("lead_id", leadId).order("scheduled_at", { ascending: false });
      return (data ?? []) as FollowUp[];
    } catch { return []; }
  },

  async getTodaysFollowUps(gymId: string): Promise<(FollowUp & { leads?: { name: string; phone: string } })[]> {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

      const { data } = await supabase
        .from("lead_followups")
        .select("*, leads!inner(name, phone, gym_id)")
        .eq("leads.gym_id", gymId)
        .eq("status", "pending")
        .gte("scheduled_at", today)
        .lt("scheduled_at", tomorrow)
        .order("scheduled_at");

      return (data ?? []) as (FollowUp & { leads?: { name: string; phone: string } })[];
    } catch { return []; }
  },

  async getOverdueFollowUps(gymId: string): Promise<(FollowUp & { leads?: { name: string; phone: string } })[]> {
    try {
      const supabase = getSupabaseClient();
      const now = new Date().toISOString();

      const { data } = await supabase
        .from("lead_followups")
        .select("*, leads!inner(name, phone, gym_id)")
        .eq("leads.gym_id", gymId)
        .eq("status", "pending")
        .lt("scheduled_at", now)
        .order("scheduled_at");

      return (data ?? []) as (FollowUp & { leads?: { name: string; phone: string } })[];
    } catch { return []; }
  },
};
