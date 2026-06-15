import { getSupabaseClient } from "@/api/supabase";
import type { LeadStatus } from "./crm-lead-service";

export const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string; order: number }[] = [
  { status: "new", label: "New Lead", color: "#3b82f6", order: 0 },
  { status: "contacted", label: "Contacted", color: "#8b5cf6", order: 1 },
  { status: "interested", label: "Interested", color: "#f59e0b", order: 2 },
  { status: "trial_scheduled", label: "Trial Scheduled", color: "#06b6d4", order: 3 },
  { status: "trial_active", label: "Trial Active", color: "#10b981", order: 4 },
  { status: "negotiation", label: "Negotiation", color: "#f97316", order: 5 },
  { status: "converted", label: "Converted", color: "#22c55e", order: 6 },
  { status: "lost", label: "Lost", color: "#ef4444", order: 7 },
  { status: "archived", label: "Archived", color: "#6b7280", order: 8 },
];

export const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "lost", "archived"],
  contacted: ["interested", "trial_scheduled", "lost", "archived"],
  interested: ["trial_scheduled", "negotiation", "lost", "archived"],
  trial_scheduled: ["trial_active", "contacted", "lost", "archived"],
  trial_active: ["negotiation", "converted", "interested", "lost", "archived"],
  negotiation: ["converted", "interested", "lost", "archived"],
  converted: ["archived"],
  lost: ["new", "archived"],
  archived: ["new"],
};

export const crmPipelineService = {
  getStageLabel(status: LeadStatus): string {
    return PIPELINE_STAGES.find((s) => s.status === status)?.label ?? status;
  },

  getStageColor(status: LeadStatus): string {
    return PIPELINE_STAGES.find((s) => s.status === status)?.color ?? "#6b7280";
  },

  canTransition(from: LeadStatus, to: LeadStatus): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  },

  async transitionLead(leadId: string, newStatus: LeadStatus, userId?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const supabase = getSupabaseClient();

      const { data: lead } = await supabase.from("leads").select("status, name").eq("id", leadId).maybeSingle();
      if (!lead) return { ok: false, error: "Lead not found" };

      if (!this.canTransition(lead.status as LeadStatus, newStatus)) {
        return { ok: false, error: `Cannot transition from "${lead.status}" to "${newStatus}"` };
      }

      const { error } = await supabase.from("leads").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", leadId);
      if (error) return { ok: false, error: error.message };

      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        event_type: "status_change",
        description: `Status changed from "${lead.status}" to "${newStatus}"`,
        created_by: userId ?? null,
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Transition failed" };
    }
  },

  async getPipelineStats(gymId: string): Promise<Record<LeadStatus, number>> {
    const supabase = getSupabaseClient();
    const stats: Record<string, number> = {};

    for (const stage of PIPELINE_STAGES) {
      const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", stage.status);
      stats[stage.status] = count ?? 0;
    }

    return stats as Record<LeadStatus, number>;
  },
};
