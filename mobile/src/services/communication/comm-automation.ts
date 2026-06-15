import { getSupabaseClient } from "@/api/supabase";

export type AutomationTrigger =
  | "membership.expiring" | "membership.expired" | "membership.renewed"
  | "payment.due" | "payment.received" | "payment.failed"
  | "attendance.missed" | "attendance.streak" | "attendance.first_visit"
  | "lead.created" | "lead.converted" | "lead.inactive"
  | "trial.scheduled" | "trial.completed" | "trial.no_show"
  | "member.inactive" | "member.birthday" | "referral.completed";

export interface AutomationRule {
  id: string; organization_id: string; gym_id: string | null; name: string;
  trigger_event: AutomationTrigger; delay_minutes: number;
  channel: "push" | "email" | "sms" | "whatsapp";
  template_id: string | null; subject: string | null; body: string | null;
  audience_filter: Record<string, unknown>; is_active: boolean;
  last_triggered_at: string | null; created_by: string | null;
  created_at: string; updated_at: string;
}

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  "membership.expiring": "Membership Expiring (30 days)",
  "membership.expired": "Membership Expired",
  "membership.renewed": "Membership Renewed",
  "payment.due": "Payment Due",
  "payment.received": "Payment Received",
  "payment.failed": "Payment Failed",
  "attendance.missed": "Attendance Missed (7 days)",
  "attendance.streak": "Attendance Streak Milestone",
  "attendance.first_visit": "First Visit",
  "lead.created": "Lead Created",
  "lead.converted": "Lead Converted",
  "lead.inactive": "Lead Inactive (14 days)",
  "trial.scheduled": "Trial Scheduled",
  "trial.completed": "Trial Completed",
  "trial.no_show": "Trial No-Show",
  "member.inactive": "Member Inactive (30 days)",
  "member.birthday": "Member Birthday",
  "referral.completed": "Referral Completed",
};

export const commAutomationService = {
  getTriggerLabels() { return TRIGGER_LABELS; },

  async getRules(orgId: string): Promise<AutomationRule[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("comm_automation_rules").select("*").eq("organization_id", orgId).order("name");
    return (data ?? []) as AutomationRule[];
  },

  async createRule(rule: Omit<AutomationRule, "id" | "last_triggered_at" | "created_at" | "updated_at">): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("comm_automation_rules").insert(rule).select("id").maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data?.id };
    } catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Failed" }; }
  },

  async toggleRule(id: string, isActive: boolean): Promise<boolean> {
    try { const supabase = getSupabaseClient(); const { error } = await supabase.from("comm_automation_rules").update({ is_active: isActive }).eq("id", id); return !error; } catch { return false; }
  },

  async deleteRule(id: string): Promise<boolean> {
    try { const supabase = getSupabaseClient(); const { error } = await supabase.from("comm_automation_rules").delete().eq("id", id); return !error; } catch { return false; }
  },
};
