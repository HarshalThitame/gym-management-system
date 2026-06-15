import { getSupabaseClient } from "@/api/supabase";

export interface BranchPerformance {
  branchId: string; branchName: string; revenue: number; members: number; attendance: number;
  leads: number; conversions: number; conversionRate: number; retention: number; score: number;
}

export const branchAnalyticsService = {
  async getBranchPerformances(orgId: string): Promise<BranchPerformance[]> {
    try {
    const supabase = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: branches } = await supabase.from("branches").select("id, name").eq("organization_id", orgId).eq("status", "active");
    if (!branches) return [];

    const performances = await Promise.all(branches.map(async (b) => {
      const [revenue, members, attendance, leads, conversions] = await Promise.all([
        supabase.from("payments").select("amount").eq("branch_id", b.id).eq("status", "paid").gte("created_at", monthStart),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("branch_id", b.id),
        supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("branch_id", b.id).gte("check_in_at", monthStart),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("branch_id", b.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("branch_id", b.id).eq("status", "converted"),
      ]);

      const rev = (revenue.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
      const totalLeads = leads.count ?? 0;
      return {
        branchId: b.id, branchName: b.name,
        revenue: rev,
        members: members.count ?? 0,
        attendance: attendance.count ?? 0,
        leads: totalLeads,
        conversions: conversions.count ?? 0,
        conversionRate: totalLeads > 0 ? Math.round(((conversions.count ?? 0) / totalLeads) * 100) : 0,
        retention: 80,
        score: Math.round((rev > 0 ? 25 : 0) + ((members.count ?? 0) > 0 ? 25 : 0) + (attendance.count ?? 0 > 0 ? 25 : 0) + (conversions.count ?? 0 > 0 ? 25 : 0)),
      };
    }));

    return performances.sort((a, b) => b.score - a.score);
    } catch { return []; }
  },
};
