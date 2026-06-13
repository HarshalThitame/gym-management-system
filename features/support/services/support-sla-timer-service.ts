import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";

export type SlaStatus = "good" | "warning" | "breached" | "met";

export type SlaTimerInfo = {
  status: SlaStatus;
  label: string;
  progressPercent: number;
  remainingMinutes: number;
  totalMinutes: number;
  deadline: string;
};

export async function computeSlaStatus(ticketId: string): Promise<SlaTimerInfo | null> {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: ticket } = await sdb
    .from("support_tickets")
    .select("created_at, sla_policy_id, first_response_at, resolved_at, sla_breached, priority")
    .eq("id", ticketId)
    .single();

  if (!ticket) return null;

  const t = ticket as Record<string, unknown>;
  const slaPolicyId = t.sla_policy_id as string | null;

  if (!slaPolicyId) return null;

  const { data: policy } = await sdb.from("support_sla_policies").select("first_response_minutes, resolution_minutes").eq("id", slaPolicyId).single();
  if (!policy) return null;

  const p = policy as { first_response_minutes: number; resolution_minutes: number };
  const created = new Date(t.created_at as string);
  const now = new Date();
  const elapsed = (now.getTime() - created.getTime()) / 60000;

  const isResolved = !!t.resolved_at || !!t.first_response_at;
  const totalMinutes = isResolved ? p.resolution_minutes : p.first_response_minutes;
  const remaining = Math.max(0, totalMinutes - elapsed);
  const percent = Math.min(100, Math.round((elapsed / totalMinutes) * 100));

  let status: SlaStatus = "good";
  if (t.sla_breached) status = "breached";
  else if (percent >= 80) status = "warning";
  else if (isResolved) status = "met";

  const deadline = new Date(created.getTime() + totalMinutes * 60000);

  return {
    status,
    label: isResolved ? "Resolved" : `${Math.round(remaining)}m remaining`,
    progressPercent: percent,
    remainingMinutes: Math.round(remaining),
    totalMinutes,
    deadline: deadline.toISOString(),
  };
}

export async function getSlaBatchStatus(ticketIds: string[]): Promise<Map<string, SlaTimerInfo | null>> {
  const results = new Map<string, SlaTimerInfo | null>();
  const batch = await Promise.all(ticketIds.map((id) => computeSlaStatus(id).catch(() => null)));
  ticketIds.forEach((id, i) => results.set(id, batch[i] ?? null));
  return results;
}
