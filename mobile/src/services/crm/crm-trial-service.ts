import { getSupabaseClient } from "@/api/supabase";
import { crmLeadService, type LeadExtended } from "./crm-lead-service";

export interface TrialSession {
  id: string;
  lead_id: string;
  member_id: string | null;
  trainer_id: string | null;
  scheduled_at: string;
  completed_at: string | null;
  status: "scheduled" | "active" | "completed" | "no_show" | "cancelled";
  feedback: string | null;
  converted: boolean;
  created_by: string | null;
  created_at: string;
}

export const crmTrialService = {
  async scheduleTrial(data: {
    lead_id: string;
    scheduled_at: string;
    trainer_id?: string;
  }): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data: result, error } = await supabase.from("trial_sessions").insert({
        lead_id: data.lead_id,
        scheduled_at: data.scheduled_at,
        trainer_id: data.trainer_id ?? null,
        status: "scheduled",
      }).select("id").maybeSingle();

      if (error) return { ok: false, error: error.message };

      await crmLeadService.updateLead(data.lead_id, { status: "trial_scheduled" } as any);
      await crmLeadService.addTimelineEvent(data.lead_id, "trial_scheduled", `Trial scheduled for ${new Date(data.scheduled_at).toLocaleDateString()}`);

      return { ok: true, id: result?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed to schedule trial" };
    }
  },

  async completeTrial(trialId: string, feedback: string, converted: boolean): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data: trial } = await supabase.from("trial_sessions").select("lead_id").eq("id", trialId).maybeSingle();
      if (!trial) return false;

      const { error } = await supabase.from("trial_sessions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        feedback,
        converted,
      }).eq("id", trialId);

      if (error) return false;

      await crmLeadService.updateLead(trial.lead_id, {
        status: converted ? "negotiation" : "interested",
      } as any);

      await crmLeadService.addTimelineEvent(trial.lead_id, "trial_completed",
        `Trial completed. ${converted ? "Ready for conversion" : "Not converted yet"}`);

      return true;
    } catch { return false; }
  },

  async getTrialsForGym(gymId: string): Promise<(TrialSession & { leads?: { name: string; phone: string } })[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("trial_sessions")
        .select("*, leads!inner(name, phone, gym_id)")
        .eq("leads.gym_id", gymId)
        .order("scheduled_at", { ascending: false });
      return (data ?? []) as (TrialSession & { leads?: { name: string; phone: string } })[];
    } catch { return []; }
  },

  async getTrialsForTrainer(trainerId: string): Promise<(TrialSession & { leads?: { name: string; phone: string } })[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("trial_sessions")
        .select("*, leads!inner(name, phone)")
        .eq("trainer_id", trainerId)
        .order("scheduled_at", { ascending: false });
      return (data ?? []) as (TrialSession & { leads?: { name: string; phone: string } })[];
    } catch { return []; }
  },

  async getTodaysTrials(gymId: string): Promise<(TrialSession & { leads?: { name: string; phone: string } })[]> {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("trial_sessions")
        .select("*, leads!inner(name, phone, gym_id)")
        .eq("leads.gym_id", gymId)
        .in("status", ["scheduled", "active"])
        .gte("scheduled_at", today)
        .lt("scheduled_at", tomorrow)
        .order("scheduled_at");
      return (data ?? []) as (TrialSession & { leads?: { name: string; phone: string } })[];
    } catch { return []; }
  },

  async markNoShow(trialId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data: trial } = await supabase.from("trial_sessions").select("lead_id").eq("id", trialId).maybeSingle();
      if (!trial) return false;
      const { error } = await supabase.from("trial_sessions").update({ status: "no_show" }).eq("id", trialId);
      if (error) return false;
      await crmLeadService.addTimelineEvent(trial.lead_id, "trial_no_show", "Member did not show for trial");
      return true;
    } catch { return false; }
  },
};
