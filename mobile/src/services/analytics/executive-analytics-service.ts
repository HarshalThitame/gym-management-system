import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";

export interface ExecutiveDashboard {
  revenue: { today: number; month: number; year: number; growth: number; forecast: number };
  members: { total: number; active: number; expired: number; frozen: number; newThisMonth: number; renewedThisMonth: number; churnRate: number; retentionRate: number };
  attendance: { today: number; month: number; avgDaily: number; peakHour: number; complianceRate: number };
  crm: { totalLeads: number; newLeads: number; converted: number; conversionRate: number; followupsToday: number };
  health: { score: number; level: "excellent" | "good" | "average" | "at_risk" };
  subscriptions: { planTier: string; memberUsage: number; memberLimit: number; branchUsage: number; branchLimit: number };
  recentActivities: number;
}

export const executiveAnalyticsService = {
  async getExecutiveDashboard(orgId: string, gymId?: string): Promise<ExecutiveDashboard> {
    try {
    const cacheKey = `exec:dash:${orgId}:${gymId ?? "all"}`;
    const cached = await offlineCache.get<ExecutiveDashboard>(cacheKey);
    if (cached && !cached.stale) return cached.data;

    const supabase = getSupabaseClient();
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();

    const scope = (query: any, field: string) => gymId ? query.eq(field, gymId) : query.eq("organization_id", orgId);
    const memberScope = (query: any) => gymId ? query.eq("gym_id", gymId) : query.eq("organization_id", orgId);

    const [
      revenueToday, revenueMonth, revenueYear, revenueLastMonth,
      totalMembers, activeMembers, expiredMembers, frozenMembers,
      newMembers, renewedMembers,
      attendanceToday, attendanceMonth,
      totalLeads, newLeads, convertedLeads,
      followupsToday,
      planSub,
    ] = await Promise.all([
      scope(supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", today), "gym_id"),
      scope(supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", monthStart), "gym_id"),
      scope(supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", yearStart), "gym_id"),
      scope(supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd), "gym_id"),
      memberScope(supabase.from("members").select("id", { count: "exact", head: true })),
      memberScope(supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active")),
      memberScope(supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "inactive")),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "frozen").eq("organization_id", orgId),
      memberScope(supabase.from("members").select("id", { count: "exact", head: true }).gte("joined_at", monthStart)),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("start_date", monthStart),
      scope(supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).gte("check_in_at", today), "gym_id"),
      scope(supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).gte("check_in_at", monthStart), "gym_id"),
      scope(supabase.from("leads").select("id", { count: "exact", head: true }), "gym_id"),
      scope(supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"), "gym_id"),
      scope(supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted"), "gym_id"),
      scope(supabase.from("lead_followups").select("id", { count: "exact", head: true }).eq("status", "pending"), "gym_id"),
      supabase.from("platform_subscriptions").select("*").eq("organization_id", orgId).maybeSingle(),
    ]);

    const revMonth = (revenueMonth.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const revLastMonth = (revenueLastMonth.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const growth = revLastMonth > 0 ? Math.round(((revMonth - revLastMonth) / revLastMonth) * 100) : 0;
    const totalM = totalMembers.count ?? 1;
    const churned = expiredMembers.count ?? 0;

    const retentionScore = Math.round(((totalM - churned) / totalM) * 100);
    const crmConversion = (totalLeads.count ?? 0) > 0 ? Math.round(((convertedLeads.count ?? 0) / (totalLeads.count ?? 1)) * 100) : 0;
    const attendanceCompliance = daysElapsed > 0 ? Math.min(100, Math.round(((attendanceMonth.count ?? 0) / (activeMembers.count ?? 1)) / daysElapsed * 100)) : 0;

    const scoreFactors = [
      growth > 0 ? 20 : Math.max(0, 20 + growth),
      retentionScore > 80 ? 20 : retentionScore > 60 ? 15 : retentionScore > 40 ? 10 : 5,
      crmConversion > 20 ? 20 : crmConversion > 10 ? 15 : crmConversion > 5 ? 10 : 5,
      attendanceCompliance > 50 ? 20 : attendanceCompliance > 30 ? 15 : attendanceCompliance > 20 ? 10 : 5,
      activeMembers.count ?? 0 > 0 ? 20 : 5,
    ];
    const healthScore = Math.round(scoreFactors.reduce((a, b) => a + b, 0) / 5);
    const healthLevel = healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : healthScore >= 40 ? "average" : "at_risk" as const;

    const s = planSub.data as any;
    const dashboard: ExecutiveDashboard = {
      revenue: {
        today: (revenueToday.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0),
        month: revMonth,
        year: (revenueYear.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0),
        growth,
        forecast: daysElapsed > 0 ? Math.round((revMonth / daysElapsed) * daysInMonth) : 0,
      },
      members: {
        total: totalM,
        active: activeMembers.count ?? 0,
        expired: expiredMembers.count ?? 0,
        frozen: frozenMembers.count ?? 0,
        newThisMonth: newMembers.count ?? 0,
        renewedThisMonth: renewedMembers.count ?? 0,
        churnRate: totalM > 0 ? Math.round((churned / totalM) * 100) : 0,
        retentionRate: retentionScore,
      },
      attendance: {
        today: attendanceToday.count ?? 0,
        month: attendanceMonth.count ?? 0,
        avgDaily: daysElapsed > 0 ? Math.round((attendanceMonth.count ?? 0) / daysElapsed) : 0,
        peakHour: 17,
        complianceRate: attendanceCompliance,
      },
      crm: {
        totalLeads: totalLeads.count ?? 0,
        newLeads: newLeads.count ?? 0,
        converted: convertedLeads.count ?? 0,
        conversionRate: crmConversion,
        followupsToday: followupsToday.count ?? 0,
      },
      health: { score: healthScore, level: healthLevel },
      subscriptions: {
        planTier: s?.plan_tier ?? s?.name ?? "Free",
        memberUsage: activeMembers.count ?? 0,
        memberLimit: s?.member_limit ?? 100,
        branchUsage: 0,
        branchLimit: s?.branch_limit ?? 1,
      },
      recentActivities: (recentActivities?.data ?? []).length ?? 0,
    };

    await offlineCache.set(cacheKey, dashboard, { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true });
    return dashboard;
    } catch { return getFallbackDashboard(); }
  },
};
