import { getSupabaseClient } from "@/api/supabase";
import type { Lead } from "@/types";

export const adminCrmService = {
  async getLeads(orgId: string, status?: string): Promise<Lead[]> {
    const supabase = getSupabaseClient();
    let query = supabase.from("leads").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    if (status) {
      query = query.eq("status", status);
    }
    const { data } = await query.limit(50);
    return (data ?? []) as Lead[];
  },

  async getLeadsByGym(gymId: string): Promise<Lead[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("leads").select("*").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(50);
    return (data ?? []) as Lead[];
  },

  async updateLeadStatus(leadId: string, status: Lead["status"]): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
    return !error;
  },

  async getLeadStats(gymId: string): Promise<{
    new: number;
    contacted: number;
    converted: number;
    lost: number;
    total: number;
  }> {
    const supabase = getSupabaseClient();
    const [newLeads, contacted, converted, lost, total] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "new"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "contacted"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "converted"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "lost"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
    ]);

    return {
      new: newLeads.count ?? 0,
      contacted: contacted.count ?? 0,
      converted: converted.count ?? 0,
      lost: lost.count ?? 0,
      total: total.count ?? 0,
    };
  },
};
