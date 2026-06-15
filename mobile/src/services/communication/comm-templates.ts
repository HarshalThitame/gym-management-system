import { getSupabaseClient } from "@/api/supabase";

export type CommChannel = "push" | "email" | "sms" | "whatsapp";
export type TemplateCategory = "system" | "marketing" | "transactional" | "reminder" | "announcement";

export interface MessageTemplate {
  id: string; organization_id: string; name: string; channel: CommChannel;
  category: TemplateCategory; subject: string | null; body: string;
  variables: string[]; is_active: boolean; version: number;
  created_by: string | null; created_at: string; updated_at: string;
}

const BUILTIN_VARIABLES: Record<string, string> = {
  "{{member_name}}": "Member's full name",
  "{{gym_name}}": "Gym name",
  "{{branch_name}}": "Branch name",
  "{{org_name}}": "Organization name",
  "{{membership_expiry}}": "Membership expiry date",
  "{{membership_status}}": "Current membership status",
  "{{payment_amount}}": "Payment amount",
  "{{payment_due_date}}": "Payment due date",
  "{{trainer_name}}": "Trainer's name",
  "{{lead_name}}": "Lead's name",
  "{{trial_date}}": "Trial session date",
  "{{referral_code}}": "Referral code",
  "{{offer_name}}": "Offer/promotion name",
  "{{days_remaining}}": "Days remaining until event",
  "{{attendance_streak}}": "Current attendance streak",
};

export const commTemplateService = {
  getBuiltinVariables() { return BUILTIN_VARIABLES; },

  async getTemplates(orgId: string, channel?: CommChannel): Promise<MessageTemplate[]> {
    const supabase = getSupabaseClient();
    let q = supabase.from("comm_templates").select("*").eq("organization_id", orgId).order("name");
    if (channel) q = q.eq("channel", channel);
    const { data } = await q;
    return (data ?? []) as MessageTemplate[];
  },

  async createTemplate(tpl: Omit<MessageTemplate, "id" | "created_at" | "updated_at">): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("comm_templates").insert(tpl).select("id").maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data?.id };
    } catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Failed" }; }
  },

  async updateTemplate(id: string, updates: Partial<MessageTemplate>): Promise<boolean> {
    try { const supabase = getSupabaseClient(); const { error } = await supabase.from("comm_templates").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id); return !error; } catch { return false; }
  },

  async renderTemplate(body: string, variables: Record<string, string>): Promise<string> {
    let rendered = body;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
    }
    return rendered;
  },
};
