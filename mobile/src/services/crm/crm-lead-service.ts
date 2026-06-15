import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";

export type LeadSource = "walk_in" | "phone" | "whatsapp" | "facebook" | "instagram" | "website" | "referral" | "google_ads" | "campaign" | "manual" | "free_trial" | "membership_inquiry" | "contact";
export type LeadStatus = "new" | "contacted" | "interested" | "trial_scheduled" | "trial_active" | "negotiation" | "converted" | "lost" | "archived";
export type LeadPriority = "low" | "medium" | "high" | "urgent";

export interface LeadExtended {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assigned_to: string | null;
  assigned_name: string | null;
  interest: string | null;
  message: string;
  notes: string | null;
  expected_revenue: number;
  lead_score: number;
  converted_member_id: string | null;
  trial_session_id: string | null;
  follow_up_at: string | null;
  last_contacted_at: string | null;
  consent_marketing: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface LeadTimeline {
  id: string;
  lead_id: string;
  event_type: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

export const crmLeadService = {
  async createLead(data: {
    organization_id: string;
    gym_id: string;
    name: string;
    phone: string;
    email?: string;
    source: LeadSource;
    interest?: string;
    message?: string;
    assigned_to?: string;
    priority?: LeadPriority;
  }): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data: result, error } = await supabase.from("leads").insert({
        organization_id: data.organization_id,
        gym_id: data.gym_id,
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        source: data.source,
        interest: data.interest ?? null,
        message: data.message ?? "New lead",
        status: "new",
        priority: data.priority ?? "medium",
        assigned_to: data.assigned_to ?? null,
        consent_marketing: true,
        created_at: new Date().toISOString(),
      }).select("id").maybeSingle();

      if (error) return { ok: false, error: error.message };
      if (result?.id) {
        await this.addTimelineEvent(result.id, "lead_created", `Lead created via ${data.source}`);
      }
      return { ok: true, id: result?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed to create lead" };
    }
  },

  async updateLead(leadId: string, updates: Partial<LeadExtended>): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("leads").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", leadId);
      return !error;
    } catch { return false; }
  },

  async getLead(leadId: string): Promise<LeadExtended | null> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("leads").select("*, assigned:assigned_to(full_name)").eq("id", leadId).maybeSingle();
      return data as LeadExtended | null;
    } catch { return null; }
  },

  async getLeadsByGym(gymId: string, status?: LeadStatus): Promise<LeadExtended[]> {
    const cacheKey = `crm:leads:${gymId}:${status ?? "all"}`;
    const cached = await offlineCache.get<LeadExtended[]>(cacheKey);
    try {
      const supabase = getSupabaseClient();
      let query = supabase.from("leads").select("*").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(100);
      if (status) query = query.eq("status", status);
      const { data } = await query;
      const leads = (data ?? []) as LeadExtended[];
      await offlineCache.set(cacheKey, leads, { ttlMs: 2 * 60 * 1000 });
      return leads;
    } catch { return cached?.data ?? []; }
  },

  async getLeadsByOrg(orgId: string): Promise<LeadExtended[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("leads").select("*, gyms(name)").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as LeadExtended[];
    } catch { return []; }
  },

  async getLeadsByAssignee(userId: string): Promise<LeadExtended[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("leads").select("*").eq("assigned_to", userId).order("follow_up_at", { ascending: true });
      return (data ?? []) as LeadExtended[];
    } catch { return []; }
  },

  async deleteLead(leadId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("leads").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", leadId);
      return !error;
    } catch { return false; }
  },

  async restoreLead(leadId: string): Promise<boolean> {
    return this.updateLead(leadId, { status: "new" } as any);
  },

  async addNote(leadId: string, content: string, userId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("lead_notes").insert({ lead_id: leadId, content, created_by: userId });
      return !error;
    } catch { return false; }
  },

  async getNotes(leadId: string): Promise<LeadNote[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      return (data ?? []) as LeadNote[];
    } catch { return []; }
  },

  async getTimeline(leadId: string): Promise<LeadTimeline[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("lead_timeline").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      return (data ?? []) as LeadTimeline[];
    } catch { return []; }
  },

  async addTimelineEvent(leadId: string, eventType: string, description: string, userId?: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase.from("lead_timeline").insert({ lead_id: leadId, event_type: eventType, description, created_by: userId ?? null });
    } catch {}
  },

  async calculateLeadScore(lead: LeadExtended): Promise<number> {
    let score = 0;
    if (lead.priority === "urgent") score += 40;
    else if (lead.priority === "high") score += 30;
    else if (lead.priority === "medium") score += 15;
    if (lead.expected_revenue > 10000) score += 20;
    else if (lead.expected_revenue > 5000) score += 10;
    if (lead.status === "interested" || lead.status === "negotiation") score += 15;
    if (lead.follow_up_at && new Date(lead.follow_up_at) < new Date()) score += 10;
    if (lead.last_contacted_at) {
      const daysSince = Math.round((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86400000);
      if (daysSince > 7) score -= 10;
    }
    return Math.max(0, Math.min(100, score));
  },

  async updateLeadScore(leadId: string): Promise<number> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) return 0;
      const score = await this.calculateLeadScore(lead);
      await this.updateLead(leadId, { lead_score: score } as any);
      return score;
    } catch { return 0; }
  },

  async findDuplicates(gymId: string, phone: string): Promise<LeadExtended[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("leads").select("*").eq("gym_id", gymId).eq("phone", phone).neq("status", "archived").limit(5);
      return (data ?? []) as LeadExtended[];
    } catch { return []; }
  },

  async searchLeads(gymId: string, query: string): Promise<LeadExtended[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("leads").select("*").eq("gym_id", gymId)
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .order("created_at", { ascending: false }).limit(20);
      return (data ?? []) as LeadExtended[];
    } catch { return []; }
  },
};
