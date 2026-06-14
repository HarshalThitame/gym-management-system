import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type SupportTicket = {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportFilters = {
  status: string;
  priority: string;
  page: number;
  pageSize: number;
};

export type SupportManagementData = {
  tickets: SupportTicket[];
  total: number;
  totalPages: number;
  openTickets: number;
  closedTickets: number;
};

export async function getSupportTickets(organizationId: string, filters: SupportFilters): Promise<SupportManagementData> {
  const supabase = await createSupabaseServerClient();

  const { data: ticketsData, count, error } = await supabase
    .from("activity_events")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("entity_type", "support_ticket")
    .order("created_at", { ascending: false })
    .range(0, 20);

  if (error) throw new Error(error.message);

  const { data: allTickets } = await supabase
    .from("activity_events")
    .select("severity")
    .eq("organization_id", organizationId)
    .eq("entity_type", "support_ticket");

  return {
    tickets: (ticketsData ?? []).map((t) => ({
      id: t.id,
      subject: t.event_type,
      description: null,
      status: "open",
      priority: t.severity ?? "normal",
      category: null,
      createdAt: t.created_at,
      updatedAt: t.created_at
    })),
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / filters.pageSize),
    openTickets: (allTickets ?? []).length,
    closedTickets: 0
  };
}

export async function createSupportTicket(
  organizationId: string,
  actorId: string | null,
  subject: string,
  description_: string,
  priority_: string = "normal",
  category_: string | null = null
): Promise<SupportTicket> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("activity_events")
    .insert({
      organization_id: organizationId,
      actor_id: actorId,
      event_type: subject,
      entity_type: "support_ticket",
      entity_id: null,
      severity: priority_ as "info" | "notice" | "warning" | "critical",
      metadata: { description: description_, category: category_ } as never
    })
    .select("id, event_type, entity_type, severity, created_at")
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    subject: data.event_type,
    description: null,
    status: "open",
    priority: data.severity ?? "normal",
    category: null,
    createdAt: data.created_at,
    updatedAt: data.created_at
  };
}
