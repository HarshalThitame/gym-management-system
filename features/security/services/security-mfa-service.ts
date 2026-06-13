import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export async function listMfaMethods(userId?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  let q = db.from("user_mfa_methods").select("*, user:profiles!user_id(id, full_name, email)").eq("is_active", true);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("enrolled_at", { ascending: false });
  return data ?? [];
}

export async function getMfaPolicies(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  let q = db.from("mfa_policies").select("*").eq("is_active", true);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data } = await q;
  return data ?? [];
}

export async function getMfaStats() {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const [totalUsers, enrolledUsers, failedAttempts, byMethod] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    db.from("user_mfa_methods").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("login_history").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    db.from("user_mfa_methods").select("method_type", { count: "exact" }).eq("is_active", true),
  ]);

  const methodCounts: Record<string, number> = {};
  for (const m of (byMethod.data ?? []) as Array<Record<string, unknown>>) {
    const mt = m.method_type as string;
    methodCounts[mt] = (methodCounts[mt] ?? 0) + 1;
  }

  return {
    totalUsers: totalUsers.count ?? 0,
    enrolledUsers: enrolledUsers.count ?? 0,
    enrollmentRate: totalUsers.count ? Math.round((enrolledUsers.count! / totalUsers.count) * 100) : 0,
    failedMfa24h: failedAttempts.count ?? 0,
    byMethod: methodCounts,
  };
}

export async function removeMfaMethod(methodId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("user_mfa_methods").update({ is_active: false }).eq("id", methodId);
}

export async function createMfaPolicy(input: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data, error } = await db.from("mfa_policies").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
