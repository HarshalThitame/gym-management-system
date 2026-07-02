import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type UserSession = Database["public"]["Tables"]["user_sessions"]["Row"];
export type IpWhitelistEntry = Database["public"]["Tables"]["ip_whitelist"]["Row"];
export type PasswordPolicy = Database["public"]["Tables"]["password_policies"]["Row"];

// Session Management
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSession(
  userId: string,
  sessionToken: string,
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    deviceType?: "desktop" | "mobile" | "tablet" | "unknown";
  }
): Promise<UserSession> {
  const supabase = getSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      session_token: sessionToken,
      ip_address: metadata.ipAddress ?? null,
      user_agent: metadata.userAgent ?? null,
      device_name: metadata.deviceName ?? null,
      device_type: metadata.deviceType ?? "unknown",
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("user_sessions")
    .update({ is_active: false })
    .eq("id", sessionId)
    .eq("user_id", userId);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("user_sessions")
    .update({ is_active: false })
    .eq("user_id", userId);

  if (exceptSessionId) {
    query = query.neq("id", exceptSessionId);
  }

  await query;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("user_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

// IP Whitelisting
export async function getIpWhitelist(organizationId?: string, gymId?: string): Promise<IpWhitelistEntry[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("ip_whitelist").select("*").eq("is_active", true);
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (gymId) query = query.eq("gym_id", gymId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addIpToWhitelist(
  ipAddress: string,
  options: { organizationId?: string; gymId?: string; label?: string; createdBy?: string }
): Promise<IpWhitelistEntry> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ip_whitelist")
    .insert({
      ip_address: ipAddress,
      organization_id: options.organizationId ?? null,
      gym_id: options.gymId ?? null,
      label: options.label ?? null,
      created_by: options.createdBy ?? null
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removeIpFromWhitelist(id: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from("ip_whitelist").delete().eq("id", id);
}

export async function checkIpWhitelist(ipAddress: string, gymId?: string, organizationId?: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("is_ip_whitelisted", {
    p_ip: ipAddress,
    p_gym_id: gymId ?? null,
    p_org_id: organizationId ?? null
  });

  if (error) {
    console.error("[Security] IP whitelist check failed:", error);
    return true; // Fail open
  }

  return data ?? true;
}

// Password Policy
export async function getPasswordPolicy(organizationId?: string): Promise<PasswordPolicy | null> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("password_policies").select("*");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePasswordPolicy(
  organizationId: string,
  policy: Partial<PasswordPolicy>
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from("password_policies").upsert({
    organization_id: organizationId,
    ...policy
  }, { onConflict: "organization_id" });
}

export async function validatePassword(password: string, organizationId?: string): Promise<{ valid: boolean; errors: string[] }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("validate_password_strength", {
    p_password: password,
    p_org_id: organizationId ?? null
  });

  if (error) {
    console.error("[Security] Password validation failed:", error);
    return { valid: true, errors: [] }; // Fail open
  }

  return {
    valid: (data as { valid: boolean }).valid,
    errors: (data as { errors: string[] }).errors ?? []
  };
}

// Login Attempts & Lockout
export async function recordLoginAttempt(email: string, success: boolean, metadata?: { ipAddress?: string; failureReason?: string }): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from("login_attempts").insert({
    email,
    ip_address: metadata?.ipAddress ?? null,
    success,
    failure_reason: metadata?.failureReason ?? null
  });
}

export async function checkAccountLockout(email: string): Promise<{ locked: boolean; lockedUntil?: string }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("is_account_locked", { p_email: email });

  if (error) return { locked: false };

  if (data) {
    const { data: lockout } = await supabase
      .from("account_lockouts")
      .select("locked_until")
      .eq("email", email)
      .single();

    return { locked: true, lockedUntil: lockout?.locked_until };
  }

  return { locked: false };
}

export async function lockAccount(email: string, durationMinutes: number, metadata?: { userId?: string; ipAddress?: string; reason?: string }): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

  await supabase.from("account_lockouts").upsert({
    user_id: metadata?.userId ?? null,
    email,
    ip_address: metadata?.ipAddress ?? null,
    locked_until: lockedUntil.toISOString(),
    reason: metadata?.reason ?? null
  }, { onConflict: "email" });
}

export async function unlockAccount(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("account_lockouts")
    .update({ unlocked_at: new Date().toISOString(), locked_until: new Date().toISOString() })
    .eq("email", email);
}

export async function getRecentFailedAttempts(email: string, minutes: number = 15): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const { count, error } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("email", email)
    .eq("success", false)
    .gte("created_at", since.toISOString());

  if (error) return 0;
  return count ?? 0;
}
