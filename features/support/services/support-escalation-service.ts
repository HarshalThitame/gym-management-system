import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";

export async function listEscalationRules(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  let q = sdb.from("support_escalation_rules").select("*");
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q.order("escalate_from_level", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createEscalationRule(input: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb.from("support_escalation_rules").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function escalateTicket(ticketId: string, escalatedTo: string, reason: string, triggeredBy: string, escalatedBy: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data: ticket } = await sdb.from("support_tickets").select("escalation_level, assigned_to").eq("id", ticketId).single();
  if (!ticket) throw new Error("Ticket not found");

  const t = ticket as { escalation_level: number; assigned_to: string | null };
  const newLevel = Math.min(t.escalation_level + 1, 5);

  const { error: escError } = await sdb.from("support_ticket_escalations").insert({
    ticket_id: ticketId,
    escalated_from_level: t.escalation_level,
    escalated_to_level: newLevel,
    escalated_to: escalatedTo,
    reason,
    triggered_by: triggeredBy,
    created_by: escalatedBy,
  });
  if (escError) throw new Error(escError.message);

  const { error: updateError } = await sdb.from("support_tickets").update({
    escalation_level: newLevel,
    is_escalated: true,
    assigned_to: escalatedTo,
  }).eq("id", ticketId);
  if (updateError) throw new Error(updateError.message);
}

export async function resolveEscalation(escalationId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { error } = await sdb.from("support_ticket_escalations").update({
    resolved_at: new Date().toISOString(),
  }).eq("id", escalationId);
  if (error) throw new Error(error.message);
}

export async function getEscalationSummary() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const [byLevel, escalations, rules] = await Promise.all([
    sdb.from("support_tickets").select("escalation_level", { count: "exact" }).eq("is_escalated", true),
    sdb.from("support_ticket_escalations").select("*").eq("resolved_at", null).order("created_at", { ascending: false }),
    sdb.from("support_escalation_rules").select("*").eq("is_active", true).order("escalate_from_level", { ascending: true }),
  ]);

  const levelCounts: Record<number, number> = {};
  for (const ticket of (byLevel.data ?? []) as Array<{ escalation_level: number }>) {
    const level = ticket.escalation_level;
    levelCounts[level] = (levelCounts[level] ?? 0) + 1;
  }

  return {
    byLevel: Object.entries(levelCounts).map(([level, count]) => ({ level: Number(level), count })),
    activeEscalations: escalations.data ?? [],
    escalationRules: rules.data ?? [],
  };
}

export async function autoEscalateByRules() {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: rules } = await sdb.from("support_escalation_rules").select("*").eq("is_active", true);
  if (!rules) return;

  for (const rule of rules as Array<Record<string, unknown>>) {
    const triggerOn = rule.trigger_on as string;
    const escalateAfterMinutes = rule.escalate_after_minutes as number | null;
    const escalateFromLevel = rule.escalate_from_level as number;
    const escalateToLevel = rule.escalate_to_level as number;

    if (!escalateAfterMinutes) continue;

    const cutoff = new Date(Date.now() - escalateAfterMinutes * 60000).toISOString();
    let query = sdb.from("support_tickets").select("id, assigned_to").eq("escalation_level", escalateFromLevel).lte("created_at", cutoff);

    if (triggerOn === "sla_breach") query = query.eq("sla_breached", true);
    if (triggerOn === "priority") {
      query = query.eq("priority", rule.priority_from as string);
    }

    const { data: tickets } = await query;
    for (const ticket of (tickets ?? []) as Array<{ id: string; assigned_to: string | null }>) {
      try {
        await escalateTicket(ticket.id, rule.escalated_to as string ?? ticket.assigned_to ?? "", `Automatic escalation: ${rule.name as string}`, "automatic", "");
      } catch {}
    }
  }
}
