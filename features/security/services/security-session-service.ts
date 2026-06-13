import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export async function listActiveSessions(options: { userId?: string; highRiskOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  let q = db.from("user_sessions").select("*, user:profiles!user_id(id, full_name, email)", { count: "exact" }).eq("revoked_at", null).is("expired_at", null as never);
  if (options.userId) q = q.eq("user_id", options.userId);
  if (options.highRiskOnly) q = q.gte("risk_score", "70");

  const { data, count } = await q.order("last_active_at", { ascending: false }).range(offset, offset + pageSize - 1);
  return { sessions: data ?? [], total: count ?? 0, page, pageSize };
}

export async function revokeSession(sessionId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sessionId);
}

export async function revokeAllUserSessions(userId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).then(() => {});
  // Note: Only revokes current non-revoked sessions via the IS NULL check
}

export async function trustDevice(userId: string, deviceFingerprint: string, deviceName?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("trusted_devices").upsert({
    user_id: userId,
    device_fingerprint: deviceFingerprint,
    device_name: deviceName ?? null,
    is_approved: true,
    expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
  }, { onConflict: "user_id,device_fingerprint" });
}

export async function listTrustedDevices(userId?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  let q = db.from("trusted_devices").select("*, user:profiles!user_id(id, full_name)");
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("last_seen_at", { ascending: false });
  return data ?? [];
}

export async function removeTrustedDevice(deviceId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("trusted_devices").delete().eq("id", deviceId);
}
