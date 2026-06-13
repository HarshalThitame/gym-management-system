import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";

export type AgentWithWorkload = {
  id: string;
  name: string;
  activeTicketCount: number;
  skills: string[];
};

export async function getAvailableAgents(organizationId?: string) {
  const supabase = await createSupabaseServerClient();

  const sdb = db(supabase as unknown);
  let query = sdb
    .from("profiles")
    .select("id, full_name");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: agents, error } = await query;
  if (error) throw new Error(error.message);

  const agentsWithLoad: AgentWithWorkload[] = [];
  for (const agent of agents ?? []) {
    agentsWithLoad.push({
      id: agent.id,
      name: agent.full_name ?? "Unknown",
      activeTicketCount: 0,
      skills: [],
    });
  }

  return agentsWithLoad;
}

export async function autoAssignTicket(ticketId: string, strategy: "round_robin" | "workload" | "skill" | "branch") {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data: ticket } = await sdb.from("support_tickets").select("*").eq("id", ticketId).single();
  if (!ticket) throw new Error("Ticket not found");

  const agents = await getAvailableAgents(undefined);
  if (agents.length === 0) throw new Error("No available agents");

  let selected: AgentWithWorkload;

  switch (strategy) {
    case "workload":
      agents.sort((a, b) => a.activeTicketCount - b.activeTicketCount);
      selected = agents[0]!;
      break;
    case "round_robin":
      selected = agents[Math.floor(Math.random() * agents.length)]!;
      break;
    default:
      selected = agents[Math.floor(Math.random() * agents.length)]!;
  }

  return selected;
}
