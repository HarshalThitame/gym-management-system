import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";
import type { SupportSlaPolicyRow } from "@/types/enterprise";

export async function listSlaPolicies(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  let q = sdb.from("support_sla_policies").select("*");
  if (organizationId) q = q.eq("organization_id", organizationId);
  q = q.order("priority", { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as unknown as SupportSlaPolicyRow[];
}

export async function createSlaPolicy(input: {
  organizationId?: string;
  name: string;
  description?: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationMinutes?: number;
  reopenMinutes?: number;
  isDefault?: boolean;
  createdBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb.from("support_sla_policies").insert({
    organization_id: input.organizationId ?? null,
    name: input.name,
    description: input.description ?? null,
    priority: input.priority,
    first_response_minutes: input.firstResponseMinutes,
    resolution_minutes: input.resolutionMinutes,
    escalation_minutes: input.escalationMinutes ?? null,
    reopen_minutes: input.reopenMinutes ?? null,
    is_default: input.isDefault ?? false,
    created_by: input.createdBy,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as SupportSlaPolicyRow;
}

export async function updateSlaPolicy(policyId: string, input: Partial<{
  name: string;
  description: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationMinutes: number;
  reopenMinutes: number;
  isDefault: boolean;
  isActive: boolean;
}>) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const payload: Record<string, unknown> = {};
  if (input.name) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.priority) payload.priority = input.priority;
  if (input.firstResponseMinutes) payload.first_response_minutes = input.firstResponseMinutes;
  if (input.escalationMinutes !== undefined) payload.escalation_minutes = input.escalationMinutes;
  if (input.reopenMinutes !== undefined) payload.reopen_minutes = input.reopenMinutes;
  if (input.isDefault !== undefined) payload.is_default = input.isDefault;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { data, error } = await sdb.from("support_sla_policies").update(payload).eq("id", policyId).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as SupportSlaPolicyRow;
}

export async function getSlaDashboard() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const [totalResult, breachedResult, atRiskResult, openResult, slaEventsResult] = await Promise.all([
    sdb.from("support_tickets").select("*", { count: "exact", head: true }),
    sdb.from("support_tickets").select("*", { count: "exact", head: true }).eq("sla_breached", true),
    sdb.from("support_sla_events").select("*", { count: "exact", head: true }).eq("status", "warning"),
    sdb.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_review", "in_progress"]),
    sdb.from("support_sla_events").select("*").in("status", ["met", "breached"]),
  ]);

  const slaEvents = slaEventsResult.data ?? [];
  const metCount = slaEvents.filter((e: Record<string, unknown>) => e.status === "met").length;
  const breachedCount = slaEvents.filter((e: Record<string, unknown>) => e.status === "breached").length;
  const slaCompliance = (metCount + breachedCount) > 0
    ? Math.round((metCount / (metCount + breachedCount)) * 100)
    : 100;

  return {
    totalTickets: totalResult.count ?? 0,
    breachedCount: breachedResult.count ?? 0,
    atRiskCount: atRiskResult.count ?? 0,
    slaCompliancePercent: slaCompliance,
  };
}
