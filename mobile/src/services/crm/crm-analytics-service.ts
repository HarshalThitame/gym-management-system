import { getSupabaseClient } from "@/api/supabase";

export interface CRMAnalytics {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  trialsScheduled: number;
  trialsActive: number;
  trialsCompleted: number;
  followUpsToday: number;
  followUpsOverdue: number;
  leadsBySource: Record<string, number>;
  revenueGenerated: number;
  averageConversionDays: number;
  pipelineValue: number;
}

export const crmAnalyticsService = {
  async getGymCRMAnalytics(gymId: string): Promise<CRMAnalytics> {
    const supabase = getSupabaseClient();

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      total, newLeads, contacted, converted, lost,
      trials, trialsActiveVal, trialsCompletedVal,
      followUpsTodayTotal, followUpsOverdueTotal,
      sources, revenue, avgDays,
    ] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "new"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "contacted"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "converted"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "lost"),
      supabase.from("trial_sessions").select("id", { count: "exact", head: true }).eq("leads.gym_id", gymId).gte("scheduled_at", today),
      supabase.from("trial_sessions").select("id", { count: "exact", head: true }).eq("leads.gym_id", gymId).eq("status", "active"),
      supabase.from("trial_sessions").select("id", { count: "exact", head: true }).eq("leads.gym_id", gymId).eq("status", "completed"),
      supabase.from("lead_followups").select("id", { count: "exact", head: true }).eq("leads.gym_id", gymId).eq("status", "pending").gte("scheduled_at", today).lt("scheduled_at", new Date(Date.now() + 86400000).toISOString()),
      supabase.from("lead_followups").select("id", { count: "exact", head: true }).eq("leads.gym_id", gymId).eq("status", "pending").lt("scheduled_at", now),
      supabase.from("leads").select("source").eq("gym_id", gymId),
      supabase.from("leads").select("expected_revenue").eq("gym_id", gymId).eq("status", "converted"),
      supabase.from("leads").select("created_at, updated_at").eq("gym_id", gymId).eq("status", "converted"),
    ]);

    const sourceMap: Record<string, number> = {};
    for (const l of (sources.data ?? []) as { source: string }[]) {
      sourceMap[l.source] = (sourceMap[l.source] ?? 0) + 1;
    }

    const totalRev = ((revenue.data ?? []) as { expected_revenue: number }[]).reduce((s, r) => s + (r.expected_revenue ?? 0), 0);
    const totalLeadsCount = total.count ?? 0;

    const avgDaysVal = (() => {
      const days = (avgDays.data ?? []) as { created_at: string; updated_at: string }[];
      if (days.length === 0) return 0;
      const totalDays = days.reduce((s, d) => {
        return s + Math.round((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400000);
      }, 0);
      return Math.round(totalDays / days.length);
    })();

    return {
      totalLeads: totalLeadsCount,
      newLeads: newLeads.count ?? 0,
      contactedLeads: contacted.count ?? 0,
      convertedLeads: converted.count ?? 0,
      lostLeads: lost.count ?? 0,
      conversionRate: totalLeadsCount > 0 ? Math.round(((converted.count ?? 0) / totalLeadsCount) * 100) : 0,
      trialsScheduled: trials.count ?? 0,
      trialsActive: trialsActiveVal.count ?? 0,
      trialsCompleted: trialsCompletedVal.count ?? 0,
      followUpsToday: followUpsTodayTotal.count ?? 0,
      followUpsOverdue: followUpsOverdueTotal.count ?? 0,
      leadsBySource: sourceMap,
      revenueGenerated: totalRev,
      averageConversionDays: avgDaysVal,
      pipelineValue: ((sources.data ?? []) as { expected_revenue?: number }[]).reduce((s, l) => s + (l.expected_revenue ?? 0), 0),
    };
  },

  async getOrgCRMAnalytics(orgId: string): Promise<CRMAnalytics> {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    const [total, converted, lost, sources, revenue] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "converted"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "lost"),
      supabase.from("leads").select("source, expected_revenue").eq("organization_id", orgId),
      supabase.from("leads").select("expected_revenue").eq("organization_id", orgId).eq("status", "converted"),
    ]);

    const sourceMap: Record<string, number> = {};
    for (const l of (sources.data ?? []) as { source: string; expected_revenue?: number }[]) {
      sourceMap[l.source] = (sourceMap[l.source] ?? 0) + 1;
    }

    const totalRev = ((revenue.data ?? []) as { expected_revenue: number }[]).reduce((s, r) => s + (r.expected_revenue ?? 0), 0);
    const totalCount = total.count ?? 0;

    return {
      totalLeads: totalCount,
      newLeads: 0, contactedLeads: 0, convertedLeads: converted.count ?? 0, lostLeads: lost.count ?? 0,
      conversionRate: totalCount > 0 ? Math.round(((converted.count ?? 0) / totalCount) * 100) : 0,
      trialsScheduled: 0, trialsActive: 0, trialsCompleted: 0,
      followUpsToday: 0, followUpsOverdue: 0,
      leadsBySource: sourceMap,
      revenueGenerated: totalRev,
      averageConversionDays: 0,
      pipelineValue: (sources.data ?? []).reduce((s: number, l: any) => s + (l.expected_revenue ?? 0), 0),
    };
  },
};
