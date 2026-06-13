import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";

export type AgentMetrics = {
  agentId: string;
  agentName: string;
  activeTickets: number;
  resolvedToday: number;
  resolvedThisWeek: number;
  resolvedThisMonth: number;
  avgResponseMinutes: number;
  avgResolutionMinutes: number;
  avgCsat: number;
  breachedTickets: number;
  escalatedTickets: number;
};

export async function getAgentPerformance() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: agents } = await supabase.from("profiles").select("id, full_name");
  if (!agents) return [];

  const metrics: AgentMetrics[] = [];

  for (const agent of agents) {
    const [activeResult, todayResult, weekResult, monthResult, breachedResult, escalatedResult] = await Promise.all([
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("assigned_to", agent.id).in("status", ["open", "in_review", "in_progress", "waiting_on_customer"]),
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("assigned_to", agent.id).eq("status", "resolved").gte("resolved_at", today),
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("assigned_to", agent.id).eq("status", "resolved").gte("resolved_at", weekAgo),
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("assigned_to", agent.id).eq("status", "resolved").gte("resolved_at", monthAgo),
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("assigned_to", agent.id).eq("sla_breached", true),
      sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("assigned_to", agent.id).eq("is_escalated", true),
    ]);

    metrics.push({
      agentId: agent.id,
      agentName: agent.full_name ?? "Unknown",
      activeTickets: activeResult.count ?? 0,
      resolvedToday: todayResult.count ?? 0,
      resolvedThisWeek: weekResult.count ?? 0,
      resolvedThisMonth: monthResult.count ?? 0,
      avgResponseMinutes: 0,
      avgResolutionMinutes: 0,
      avgCsat: 0,
      breachedTickets: breachedResult.count ?? 0,
      escalatedTickets: escalatedResult.count ?? 0,
    });
  }

  metrics.sort((a, b) => b.activeTickets - a.activeTickets);
  return metrics;
}

export async function getAgentWorkload(agentId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: tickets } = await sdb
    .from("support_tickets")
    .select("*, category:support_ticket_categories(*), slaPolicy:support_sla_policies(*)")
    .eq("assigned_to", agentId)
    .in("status", ["open", "in_review", "in_progress", "waiting_on_customer", "waiting_on_third_party"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  return tickets ?? [];
}
