import { getSupabaseClient } from "@/api/supabase";

function getDefaultMembershipAnalytics(): MembershipAnalytics {
  return { total: 0, active: 0, expired: 0, frozen: 0, cancelled: 0, newThisMonth: 0, renewedThisMonth: 0, churnRate: 0, retentionRate: 100, byPlan: {}, monthlyTrend: [], avgDuration: 0, expiringThisMonth: 0 };
}

export interface MembershipAnalytics {
  total: number; active: number; expired: number; frozen: number; cancelled: number;
  newThisMonth: number; renewedThisMonth: number;
  churnRate: number; retentionRate: number;
  byPlan: Record<string, number>;
  monthlyTrend: { month: string; new: number; expired: number; renewed: number }[];
  avgDuration: number;
  expiringThisMonth: number;
}

export const membershipAnalyticsService = {
  async getMembershipAnalytics(orgId: string, months = 12): Promise<MembershipAnalytics> {
    try {
    const supabase = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const start = startDate.toISOString();

    const [total, active, expired, frozen, cancelled, newM, renewed, expiring, trends, durations] = await Promise.all([
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "expired"),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "frozen"),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "cancelled"),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("start_date", monthStart),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active").gte("start_date", monthStart),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active").lte("end_date", monthEnd).gte("end_date", monthStart),
      supabase.from("memberships").select("status, start_date, created_at").eq("organization_id", orgId).gte("created_at", start),
      supabase.from("memberships").select("start_date, end_date").eq("organization_id", orgId).eq("status", "active"),
    ]);

    const totalCount = total.count ?? 1;
    const churnRate = totalCount > 0 ? Math.round(((expired.count ?? 0) / totalCount) * 100) : 0;

    const monthlyTrend: { month: string; new: number; expired: number; renewed: number }[] = [];
    const trendRecords = (trends.data ?? []) as any[];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyTrend.push({
        month: key,
        new: trendRecords.filter((r: any) => r.created_at?.startsWith(key)).length,
        expired: trendRecords.filter((r: any) => r.status === "expired" && r.start_date?.startsWith(key)).length,
        renewed: 0,
      });
    }

    const activeDurations = (durations.data ?? []) as any[];
    const avgDuration = activeDurations.length > 0
      ? Math.round(activeDurations.reduce((s: number, m: any) => {
          return s + Math.round((new Date(m.end_date).getTime() - new Date(m.start_date).getTime()) / 86400000);
        }, 0) / activeDurations.length)
      : 0;

    return {
      total: totalCount, active: active.count ?? 0, expired: expired.count ?? 0,
      frozen: frozen.count ?? 0, cancelled: cancelled.count ?? 0,
      newThisMonth: newM.count ?? 0, renewedThisMonth: renewed.count ?? 0,
      churnRate, retentionRate: 100 - churnRate,
      byPlan: {}, monthlyTrend, avgDuration,
      expiringThisMonth: expiring.count ?? 0,
    };
    } catch { return getDefaultMembershipAnalytics(); }
  },
};
