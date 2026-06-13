import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export type DetectionRule = {
  id: string;
  name: string;
  description: string;
  type: "impossible_travel" | "device_mismatch" | "country_change" | "multiple_failed" | "vpn_detected" | "tor_detected" | "bot_activity" | "unusual_time";
  severity: "low" | "medium" | "high" | "critical";
  threshold: number;
  enabled: boolean;
};

export async function getInvestigationDetail(userId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const [profileResult, sessionsResult, loginsResult, riskResult, ticketsResult] = await Promise.all([
    db.from("profiles").select("id, full_name, email, created_at").eq("id", userId).single(),
    db.from("user_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    db.from("login_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    db.from("risk_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    db.from("support_tickets").select("id, ticket_number, subject, status, created_at").eq("customer_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);

  const profile = profileResult?.data as Record<string, unknown> | null;
  const sessions = (sessionsResult.data ?? []) as Array<Record<string, unknown>>;
  const logins = (loginsResult.data ?? []) as Array<Record<string, unknown>>;
  const riskEvents = (riskResult.data ?? []) as Array<Record<string, unknown>>;
  const tickets = (ticketsResult.data ?? []) as Array<Record<string, unknown>>;

  const failedRecent = logins.filter((l) => l.status === "failed" && new Date(l.created_at as string) > new Date(Date.now() - 3600000));
  const locations = [...new Set(sessions.map((s) => s.location_country as string).filter(Boolean))];
  const devices = [...new Set(sessions.map((s) => s.device_fingerprint as string).filter(Boolean))];
  const ips = [...new Set(logins.map((l) => l.ip_address as string).filter(Boolean))];

  const riskScore = riskEvents.length > 0
    ? Math.round(riskEvents.reduce((s, e) => s + (e.risk_score as number), 0) / riskEvents.length)
    : 0;

  return {
    profile,
    activeSessions: sessions.filter((s) => !s.revoked_at && !s.expired_at),
    loginHistory: logins,
    riskEvents,
    supportTickets: tickets,
    failedLoginCount1h: failedRecent.length,
    uniqueLocations: locations,
    uniqueDevices: devices,
    uniqueIps: ips,
    avgRiskScore: riskScore,
    detectionResults: [
      { name: "Impossible Travel", triggered: locations.length > 2, severity: "high", detail: `${locations.length} unique locations in recent sessions` },
      { name: "Multiple Failed Logins", triggered: failedRecent.length > 3, severity: failedRecent.length > 10 ? "critical" : "medium", detail: `${failedRecent.length} failed attempts in last hour` },
      { name: "Device Mismatch", triggered: devices.length > 3, severity: "medium", detail: `${devices.length} unique devices used` },
      { name: "New Country Login", triggered: locations.some((l) => l !== (sessions[0]?.location_country as string)), severity: "high", detail: "Login from new geographic location" },
    ],
  };
}

export async function forcePasswordReset(userId: string, adminId: string) {
  const supabase = await createSupabaseServerClient();
  const adminClient = supabase as never as { auth: { admin: { updateUserById: (id: string, attrs: Record<string, unknown>) => Promise<unknown> } } };
  await adminClient.auth.admin.updateUserById(userId, { password: crypto.randomUUID() + "!Aa1" });
  await supabase.from("audit_logs").insert({
    actor_id: adminId, action: "security.force_password_reset", entity_type: "user", entity_id: userId,
    metadata: { reason: "Suspicious activity investigation" },
  });
}

export async function forceMfaReset(userId: string, adminId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("user_mfa_methods").update({ is_active: false }).eq("user_id", userId);
  await supabase.from("audit_logs").insert({
    actor_id: adminId, action: "security.force_mfa_reset", entity_type: "user", entity_id: userId,
    metadata: { reason: "Suspicious activity investigation" },
  });
}

export async function blockLogin(userId: string, reason: string, adminId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await supabase.from("profiles").update({ status: "suspended" }).eq("id", userId);
  await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).then(() => {});
  await supabase.from("audit_logs").insert({
    actor_id: adminId, action: "security.block_login", entity_type: "user", entity_id: userId,
    metadata: { reason },
  });
}
