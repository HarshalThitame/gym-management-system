import { getSupabaseClient } from "@/api/supabase";
import { crmLeadService } from "./crm-lead-service";

export const crmConversionService = {
  async convertLeadToMember(leadId: string, membershipPlanId: string, userId: string): Promise<{ ok: boolean; error?: string; memberId?: string }> {
    try {
      const supabase = getSupabaseClient();
      const lead = await crmLeadService.getLead(leadId);
      if (!lead) return { ok: false, error: "Lead not found" };

      if (!lead.gym_id) return { ok: false, error: "Lead has no gym assigned" };

      const memberCode = `MEM${Date.now().toString(36).toUpperCase().slice(-6)}`;

      const { data: member, error: memberError } = await supabase.from("members").insert({
        organization_id: lead.organization_id,
        gym_id: lead.gym_id,
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email ?? null,
        member_code: memberCode,
        status: "active",
        joined_at: new Date().toISOString(),
      }).select("id").maybeSingle();

      if (memberError || !member) return { ok: false, error: memberError?.message ?? "Failed to create member" };

      const { data: plan } = await supabase.from("membership_plans").select("id, duration_days, price").eq("id", membershipPlanId).maybeSingle();
      if (!plan) return { ok: false, error: "Plan not found" };

      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + (plan.duration_days ?? 30) * 86400000);

      const { error: membershipError } = await supabase.from("memberships").insert({
        organization_id: lead.organization_id,
        gym_id: lead.gym_id,
        member_id: member.id,
        plan_id: membershipPlanId,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        total_amount: plan.price ?? 0,
        paid_amount: 0,
        status: "active",
      });

      if (membershipError) return { ok: false, error: membershipError.message };

      await supabase.from("leads").update({
        status: "converted",
        converted_member_id: member.id,
        updated_at: new Date().toISOString(),
      }).eq("id", leadId);

      await crmLeadService.addTimelineEvent(leadId, "converted",
        `Lead converted to member (Code: ${memberCode}) with plan ${plan.id}`);

      return { ok: true, memberId: member.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Conversion failed" };
    }
  },
};
