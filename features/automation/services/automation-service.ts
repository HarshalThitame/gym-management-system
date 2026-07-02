import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AutomationRuleRow = Database["public"]["Tables"]["automation_rules"]["Row"];
export type AutomationRuleInsert = Database["public"]["Tables"]["automation_rules"]["Insert"];
export type AutomationRuleUpdate = Database["public"]["Tables"]["automation_rules"]["Update"];
export type AutomationLogRow = Database["public"]["Tables"]["automation_logs"]["Row"];

export async function getAutomationRules(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("priority", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAutomationRule(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("automation_rules").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createAutomationRule(input: AutomationRuleInsert) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("automation_rules").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAutomationRule(id: string, input: AutomationRuleUpdate) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("automation_rules").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAutomationRule(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("automation_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getAutomationLogs(ruleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("automation_logs")
    .select("*")
    .eq("rule_id", ruleId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const EVENT_TYPES = [
  "member.created",
  "member.updated",
  "member.deleted",
  "member.checkin",
  "member.renewal",
  "lead.created",
  "lead.converted",
  "payment.received",
  "payment.failed",
  "subscription.expiring",
  "subscription.expired",
  "attendance.milestone",
  "class.booked",
  "class.cancelled",
  "review.submitted",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
