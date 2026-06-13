import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";
import type { SupportDashboard } from "@/types/enterprise";

export async function getSupportDashboard(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  async function fetchData(table: string, columns: string, opts?: Record<string, unknown>, filters?: Record<string, unknown>) {
    let q = sdb.from(table).select(columns, opts as never);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          q = q.in(key, value as never);
        } else {
          q = q.eq(key, value);
        }
      }
    }
    return q;
  }

  const orgFilter = organizationId ? { organization_id: organizationId } : undefined;

  const [openResult, closedResult, priorityResult, statusResult, feedbackResult, slaResult, breachedResult] = await Promise.all([
    fetchData("support_tickets", "*", { count: "exact", head: true }, { status: ["open", "in_review", "in_progress", "waiting_on_customer", "waiting_on_third_party"], ...orgFilter }),
    fetchData("support_tickets", "*", { count: "exact", head: true }, { status: ["resolved", "closed"], ...orgFilter }),
    fetchData("support_tickets", "priority", { count: "exact" }, orgFilter),
    fetchData("support_tickets", "status", { count: "exact" }, orgFilter),
    fetchData("support_customer_feedback", "score, survey_type", undefined, orgFilter),
    fetchData("support_sla_events", "*", { count: "exact", head: true }, { status: ["met", "breached"] }),
    fetchData("support_tickets", "*", { count: "exact", head: true }, { sla_breached: true, ...orgFilter }),
  ]);

  const feedback = (feedbackResult.data ?? []) as Array<Record<string, unknown>>;
  const csatScores = feedback.filter((f) => f.survey_type === "csat").map((f) => f.score as number);
  const npsScores = feedback.filter((f) => f.survey_type === "nps").map((f) => f.score as number);
  const avgCsat = csatScores.length > 0 ? csatScores.reduce((a, b) => a + b, 0) / csatScores.length : 0;
  const avgNps = npsScores.length > 0 ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length : 0;

  const slaData = (slaResult.data ?? []) as Array<Record<string, unknown>>;
  const metSlaCount = slaData.filter((e) => e.status === "met").length;
  const totalSlaEvents = slaData.length;
  const slaCompliance = totalSlaEvents > 0 ? Math.round((metSlaCount / totalSlaEvents) * 100) : 100;

  const priorityRows = (priorityResult.data ?? []) as Array<{ priority: string }>;
  const priorityMap: Record<string, number> = {};
  for (const row of priorityRows) priorityMap[row.priority] = (priorityMap[row.priority] ?? 0) + 1;

  const statusRows = (statusResult.data ?? []) as Array<{ status: string }>;
  const statusMap: Record<string, number> = {};
  for (const row of statusRows) statusMap[row.status] = (statusMap[row.status] ?? 0) + 1;

  return {
    openTickets: openResult.count ?? 0, closedTickets: closedResult.count ?? 0,
    avgResolutionMinutes: 0, slaCompliancePercent: slaCompliance,
    csatScore: Math.round(avgCsat * 10) / 10, npsScore: Math.round(avgNps * 10) / 10,
    breachedCount: breachedResult.count ?? 0, atRiskCount: 0,
    ticketsByPriority: Object.entries(priorityMap).map(([p, c]) => ({ priority: p, count: c })),
    ticketsByStatus: Object.entries(statusMap).map(([s, c]) => ({ status: s, count: c })),
    agentPerformance: [],
  } satisfies SupportDashboard;
}

export async function getTenantSupportMetrics() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: orgs } = await supabase.from("organizations").select("id, name, slug").limit(50);
  if (!orgs) return [];

  const metrics = [];
  for (const org of orgs) {
    const [totalResult, openResult, breachedResult, feedbackResult] = await Promise.all([
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("organization_id", org.id).in("status", ["open", "in_review", "in_progress"]),
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("organization_id", org.id).eq("sla_breached", true),
      sdb.from("support_customer_feedback").select("score, survey_type"),
    ]);

    const fb = (feedbackResult.data ?? []) as Array<Record<string, unknown>>;
    const csat = fb.filter((f) => f.survey_type === "csat").map((f) => f.score as number);
    const avgCsat = csat.length > 0 ? csat.reduce((a, b) => a + b, 0) / csat.length : 0;

    metrics.push({
      organizationId: org.id,
      organizationName: org.name,
      totalTickets: totalResult.count ?? 0,
      openTickets: openResult.count ?? 0,
      breachedCount: breachedResult.count ?? 0,
      avgCsat: Math.round(avgCsat * 10) / 10,
    });
  }

  metrics.sort((a, b) => b.totalTickets - a.totalTickets);
  return metrics;
}

export async function getBranchSupportMetrics() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: branches } = await supabase.from("branches").select("id, name, gym_id").limit(100);
  if (!branches) return [];

  const metrics = [];
  for (const branch of branches) {
    const { count: total } = await sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("branch_id", branch.id);
    const { count: open } = await sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("branch_id", branch.id).in("status", ["open", "in_review", "in_progress"]);
    if ((total ?? 0) > 0) {
      metrics.push({
        branchId: branch.id, branchName: branch.name, gymId: branch.gym_id,
        totalTickets: total ?? 0, openTickets: open ?? 0,
      });
    }
  }

  metrics.sort((a, b) => b.totalTickets - a.totalTickets);
  return metrics;
}

export async function getChurnCorrelation() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: healthScores } = await sdb
    .from("support_customer_health_scores")
    .select("customer_id, health_score, churn_probability, complaint_frequency, satisfaction_score, lifetime_value")
    .limit(200);

  if (!healthScores) return { highChurnCount: 0, avgHealthScore: 0, topComplaints: [], revenueAtRisk: 0 };

  const scores = healthScores as Array<Record<string, unknown>>;
  const highChurn = scores.filter((s) => (s.churn_probability as number) > 50);
  const avgHealth = scores.length > 0 ? scores.reduce((s, h) => s + (h.health_score as number), 0) / scores.length : 0;
  const revenueAtRisk = highChurn.reduce((s, h) => s + ((h.lifetime_value as number) ?? 0), 0);

  return {
    highChurnCount: highChurn.length,
    avgHealthScore: Math.round(avgHealth * 100) / 100,
    topComplaints: scores.filter((s) => (s.complaint_frequency as number) > 3).length,
    revenueAtRisk,
  };
}

export async function getAgentLeaderboard() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: agents } = await supabase.from("profiles").select("id, full_name").limit(100);
  if (!agents) return [];

  const rows = [];
  for (const agent of agents) {
    const [resolvedResult, csatResult] = await Promise.all([
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("assigned_to", agent.id).in("status", ["resolved", "closed"]),
      sdb.from("support_tickets").select("id").eq("assigned_to", agent.id).limit(1),
    ]);

    const resolvedCount = resolvedResult.count ?? 0;
    const csatScore = 0;

    if (resolvedCount > 0) {
      rows.push({
        agentId: agent.id, agentName: agent.full_name ?? "Unknown",
        resolvedCount, avgCsat: csatScore,
      });
    }
  }

  rows.sort((a, b) => b.resolvedCount - a.resolvedCount);
  return rows.slice(0, 20);
}

export async function getTicketTrend(days: number = 30) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data: tickets } = await sdb.from("support_tickets").select("created_at, status").gte("created_at", cutoff);

  if (!tickets) return [];

  const dailyMap = new Map<string, { created: number; resolved: number }>();
  for (const ticket of (tickets as Array<Record<string, unknown>>)) {
    const day = (ticket.created_at as string).slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { created: 0, resolved: 0 });
    const entry = dailyMap.get(day)!;
    entry.created++;
    if (ticket.status === "resolved" || ticket.status === "closed") entry.resolved++;
  }

  return [...dailyMap.entries()]
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
