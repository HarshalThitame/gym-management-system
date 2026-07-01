import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];
type SupportTicketMessageRow = Database["public"]["Tables"]["support_ticket_messages"]["Row"];

export type TicketWithMessages = SupportTicketRow & {
  messages?: SupportTicketMessageRow[];
};

export type SupportDashboard = {
  tickets: TicketWithMessages[];
  metrics: {
    totalTickets: number;
    openTickets: number;
    pendingTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    breachedSla: number;
  };
};

export async function getSupportDashboard(organizationId: string | null): Promise<SupportDashboard> {
  const supabase = await createSupabaseServerClient();

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select(`
      *,
      messages:support_ticket_messages(*)
    `)
    .eq("organization_id", organizationId ?? "")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const rows = (tickets ?? []) as TicketWithMessages[];

  const openTickets = rows.filter((t) => t.status === "open").length;
  const pendingTickets = rows.filter((t) => t.status === "pending").length;
  const resolvedTickets = rows.filter((t) => t.status === "resolved").length;
  const closedTickets = rows.filter((t) => t.status === "closed").length;
  const breachedSla = rows.filter((t) => t.sla_breached).length;

  return {
    tickets: rows,
    metrics: {
      totalTickets: rows.length,
      openTickets,
      pendingTickets,
      resolvedTickets,
      closedTickets,
      breachedSla
    }
  };
}

export type { SupportTicketRow, SupportTicketMessageRow };
