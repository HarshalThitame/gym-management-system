import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";
import { addNote } from "./support-ticket-service";
import { escalateTicket } from "./support-escalation-service";

type Condition = {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "in" | "contains";
  value: unknown;
};

type Action = {
  type: "assign_to" | "set_priority" | "set_status" | "escalate_to" | "add_note" | "send_notification" | "close_ticket";
  params: Record<string, unknown>;
};

export async function evaluateAutomationRules(ticketId: string, triggerEvent: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: ticket } = await sdb
    .from("support_tickets")
    .select("*, category:support_ticket_categories(*)")
    .eq("id", ticketId)
    .single();

  if (!ticket) return;

  const { data: rules } = await sdb
    .from("support_automation_rules")
    .select("*")
    .eq("trigger_event", triggerEvent)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  const ticketData = ticket as Record<string, unknown>;
  const categoryData = ticketData.category as Record<string, unknown> | null;

  for (const rule of (rules ?? []) as Array<Record<string, unknown>>) {
    try {
      const conditions = rule.conditions as Record<string, unknown>;
      const actions = rule.actions as Record<string, unknown>;
      const ruleId = rule.id as string;

      if (!evaluateConditions(ticketData, categoryData, conditions)) continue;

      await executeActions(ticketId, actions as unknown as Action[], ruleId, ticket);

      await sdb.from("support_automation_rules").update({
        execution_count: (rule.execution_count as number) + 1,
        last_executed_at: new Date().toISOString(),
      }).eq("id", ruleId);
    } catch (err) {
      console.error(`[Automation] Rule ${rule.id as string} failed:`, err);
    }
  }
}

function evaluateConditions(
  ticket: Record<string, unknown>,
  category: Record<string, unknown> | null,
  conditions: Record<string, unknown>
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  const mode = (conditions.mode as string) ?? "all";
  const rules = (conditions.rules ?? []) as Condition[];

  const results = rules.map((rule) => evaluateCondition(ticket, category, rule));

  if (mode === "any") return results.some(Boolean);
  return results.every(Boolean);
}

function evaluateCondition(
  ticket: Record<string, unknown>,
  category: Record<string, unknown> | null,
  rule: Condition
): boolean {
  const { field, operator, value } = rule;

  let actual: unknown;
  switch (field) {
    case "category":
      actual = category?.slug ?? null;
      break;
    case "category_name":
      actual = ticket.category_id;
      break;
    case "priority":
    case "status":
    case "source":
    case "customer_type":
      actual = ticket[field];
      break;
    case "age_hours":
      actual = ticket.created_at
        ? Math.round((Date.now() - new Date(ticket.created_at as string).getTime()) / 3600000)
        : 0;
      break;
    case "reopened_count":
      actual = ticket.reopened_count;
      break;
    case "sla_breached":
      actual = ticket.sla_breached;
      break;
    case "escalation_level":
      actual = ticket.escalation_level;
      break;
    case "has_attachments":
      actual = false;
      break;
    default:
      actual = ticket[field];
  }

  switch (operator) {
    case "equals": return actual === value;
    case "not_equals": return actual !== value;
    case "greater_than": return (actual as number) > (value as number);
    case "less_than": return (actual as number) < (value as number);
    case "in": return Array.isArray(value) && value.includes(actual);
    case "contains":
      return typeof actual === "string" && typeof value === "string" && actual.toLowerCase().includes(value.toLowerCase());
    default: return false;
  }
}

async function executeActions(
  ticketId: string,
  actions: Action[],
  ruleId: string,
  ticket: Record<string, unknown>
) {
  for (const action of actions) {
    try {
      switch (action.type) {
        case "assign_to":
          await executeAutoAssign(ticketId, action.params.userId as string);
          break;
        case "set_priority":
          await executeUpdatePriority(ticketId, action.params.priority as string);
          break;
        case "set_status":
          await executeSetStatus(ticketId, action.params.status as string);
          break;
        case "escalate_to":
          await executeAutoEscalate(ticketId, action.params, ruleId);
          break;
        case "add_note":
          await executeAddNote(ticketId, action.params.body as string, ruleId);
          break;
        case "close_ticket":
          await executeAutoClose(ticketId, action.params.reason as string ?? "Automated closure");
          break;
        case "send_notification":
          await executeSendNotification(ticket, action.params);
          break;
      }
    } catch (err) {
      console.error(`[Automation] Action ${action.type} failed for ticket ${ticketId}:`, err);
    }
  }
}

async function executeAutoAssign(ticketId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data: ticket } = await sdb.from("support_tickets").select("assigned_to").eq("id", ticketId).single();
  if (!ticket) return;

  const t = ticket as { assigned_to: string | null };
  await sdb.from("support_ticket_assignments").insert({
    ticket_id: ticketId,
    assigned_from: t.assigned_to,
    assigned_to: userId,
    assignment_type: "auto_skill",
  });
  await sdb.from("support_tickets").update({ assigned_to: userId }).eq("id", ticketId);
}

async function executeUpdatePriority(ticketId: string, priority: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  await sdb.from("support_tickets").update({ priority }).eq("id", ticketId);
}

async function executeSetStatus(ticketId: string, status: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const payload: Record<string, unknown> = { status };
  if (status === "closed") payload.closed_at = new Date().toISOString();
  if (status === "resolved") payload.resolved_at = new Date().toISOString();
  await sdb.from("support_tickets").update(payload).eq("id", ticketId);
}

async function executeAutoEscalate(ticketId: string, params: Record<string, unknown>, ruleId: string) {
  const escalatedTo = params.userId as string;
  const reason = (params.reason as string) ?? "Automatic escalation by automation rule.";
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data: ticket } = await sdb.from("support_tickets").select("escalation_level, assigned_to").eq("id", ticketId).single();
  if (!ticket) return;

  const t = ticket as { escalation_level: number; assigned_to: string | null };
  const newLevel = Math.min(t.escalation_level + 1, 5);

  await sdb.from("support_ticket_escalations").insert({
    ticket_id: ticketId,
    escalation_rule_id: ruleId,
    escalated_from_level: t.escalation_level,
    escalated_to_level: newLevel,
    escalated_to: escalatedTo,
    reason,
    triggered_by: "automatic",
  });
  await sdb.from("support_tickets").update({
    escalation_level: newLevel,
    is_escalated: true,
    assigned_to: escalatedTo,
  }).eq("id", ticketId);
}

async function executeAddNote(ticketId: string, body: string, ruleId: string) {
  const noteBody = `[Automation Rule] ${body}\n\nTriggered by rule: ${ruleId}`;
  try {
    await addNote(ticketId, noteBody, true, [], "");
  } catch {}
}

async function executeAutoClose(ticketId: string, reason: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const payload: Record<string, unknown> = {
    status: "closed",
    closed_at: new Date().toISOString(),
  };
  if (reason) payload.metadata = { auto_close_reason: reason };
  await sdb.from("support_tickets").update(payload).eq("id", ticketId);
}

async function executeSendNotification(ticket: Record<string, unknown>, params: Record<string, unknown>) {
  const channel = params.channel as string;
  const message = params.message as string;
  if (!channel || !message) return;

  console.log(`[Automation] Notification via ${channel} for ticket ${ticket.id}: ${message}`);
}

export async function getConditionFields() {
  return [
    { value: "category", label: "Category", type: "select", options: "categories" },
    { value: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "critical", "emergency"] },
    { value: "status", label: "Status", type: "select", options: ["open", "in_review", "in_progress", "waiting_on_customer", "waiting_on_third_party", "resolved", "closed"] },
    { value: "source", label: "Source", type: "select", options: ["manual", "email", "chat", "whatsapp", "mobile_app", "api", "automation", "phone"] },
    { value: "customer_type", label: "Customer Type", type: "select", options: ["member", "trainer", "staff", "owner", "lead", "other"] },
    { value: "age_hours", label: "Age (hours)", type: "number" },
    { value: "reopened_count", label: "Reopened Count", type: "number" },
    { value: "sla_breached", label: "SLA Breached", type: "boolean" },
    { value: "escalation_level", label: "Escalation Level", type: "number" },
  ];
}

export async function getActionTypes() {
  return [
    { value: "assign_to", label: "Assign To", params: [{ key: "userId", label: "Agent", type: "user" }] },
    { value: "set_priority", label: "Set Priority", params: [{ key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "critical", "emergency"] }] },
    { value: "set_status", label: "Set Status", params: [{ key: "status", label: "Status", type: "select", options: ["open", "in_review", "in_progress", "waiting_on_customer", "resolved", "closed"] }] },
    { value: "escalate_to", label: "Escalate To", params: [{ key: "userId", label: "Agent", type: "user" }, { key: "reason", label: "Reason", type: "text" }] },
    { value: "add_note", label: "Add Internal Note", params: [{ key: "body", label: "Note", type: "textarea" }] },
    { value: "close_ticket", label: "Close Ticket", params: [{ key: "reason", label: "Reason", type: "text" }] },
    { value: "send_notification", label: "Send Notification", params: [{ key: "channel", label: "Channel", type: "select", options: ["email", "sms", "push", "in_app"] }, { key: "message", label: "Message", type: "textarea" }] },
  ];
}
