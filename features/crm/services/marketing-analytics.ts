/**
 * Growth & Marketing Analytics Service
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getMarketingAnalytics(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };

  // Campaigns
  const { data: campaigns } = await s.from("crm_campaigns").select("id, name, channel, status, spend, budget").eq("organization_id", organizationId);

  // Leads
  const { data: leads } = await s.from("crm_leads").select("id, status_id, source_id, created_at").eq("organization_id", organizationId);

  // Referrals
  const { data: referrals } = await s.from("crm_referrals").select("id, reward_status, converted_member_id").eq("organization_id", organizationId);

  const c = (campaigns ?? []) as Array<Record<string, unknown>>;
  const l = (leads ?? []) as Array<Record<string, unknown>>;
  const r = (referrals ?? []) as Array<Record<string, unknown>>;

  return {
    campaigns: {
      total: c.length,
      active: c.filter((x) => x.status === "active").length,
      totalSpend: c.reduce((sum, x) => sum + ((x.spend as number) ?? 0), 0),
      totalBudget: c.reduce((sum, x) => sum + ((x.budget as number) ?? 0), 0),
    },
    leads: {
      total: l.length,
      converted: l.filter((x) => x.status_id).length, // simplified
    },
    referrals: {
      total: r.length,
      awarded: r.filter((x) => x.reward_status === "awarded").length,
      converted: r.filter((x) => x.converted_member_id).length,
    },
  };
}
