import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export async function createEmergencyOverride(input: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data, error } = await db.from("emergency_overrides").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listEmergencyOverrides(options: { status?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  let q = db.from("emergency_overrides").select("*, requester:profiles!requested_by(id, full_name), approver:profiles!approved_by(id, full_name)", { count: "exact" });
  if (options.status) q = q.eq("status", options.status);
  const { data, count } = await q.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
  return { overrides: data ?? [], total: count ?? 0, page, pageSize };
}

export async function approveEmergencyOverride(overrideId: string, approvedBy: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("emergency_overrides").update({
    approved_by: approvedBy,
    status: "approved",
    started_at: new Date().toISOString(),
    expired_at: new Date(Date.now() + 60 * 60000).toISOString(),
  }).eq("id", overrideId);

  await db.from("sensitive_action_logs").insert({
    actor_id: approvedBy, action_type: "emergency_access",
    resource_type: "emergency_override", resource_id: overrideId,
    description: "Emergency override approved", verification_method: "emergency_override",
    mfa_verified: true,
  });
}

export async function denyEmergencyOverride(overrideId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("emergency_overrides").update({ status: "denied" }).eq("id", overrideId);
}

export async function logSensitiveAction(input: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data, error } = await db.from("sensitive_action_logs").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listSensitiveActions(page = 1, pageSize = 25) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const offset = (page - 1) * pageSize;
  const { data, count } = await db.from("sensitive_action_logs").select("*, actor:profiles!actor_id(id, full_name)", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
  return { actions: data ?? [], total: count ?? 0, page, pageSize };
}
