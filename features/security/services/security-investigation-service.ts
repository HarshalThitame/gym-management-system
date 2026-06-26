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

export type TimelineEvent = {
  id: string;
  type: "login" | "risk_event" | "support_ticket" | "password_change" | "session_created";
  title: string;
  description: string;
  timestamp: string;
  severity?: "low" | "medium" | "high" | "critical";
  status?: string;
  metadata: Record<string, unknown>;
};

async function fetchPasswordChanges(userId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data } = await db
    .from("audit_logs")
    .select("id, action, created_at, metadata")
    .eq("entity_id", userId)
    .or("action.ilike.%password%,action.ilike.%mfa%")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function getInvestigationDetail(userId: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const [profileResult, sessionsResult, loginsResult, riskResult, ticketsResult, passwordChanges] = await Promise.all([
    db.from("profiles").select("id, full_name, email, created_at").eq("id", userId).single(),
    db.from("user_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    db.from("login_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    db.from("risk_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    db.from("support_tickets").select("id, ticket_number, subject, status, created_at").eq("customer_id", userId).order("created_at", { ascending: false }).limit(10),
    fetchPasswordChanges(userId),
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

  const timeline: TimelineEvent[] = [
    ...logins.map((l) => ({
      id: `login-${l.id as string}`,
      type: "login" as const,
      title: `${String(l.status === "success" ? "Successful Login" : "Failed Login")}`,
      description: `${String(l.email ?? "")} from ${String(l.ip_address ?? "unknown IP")}`,
      timestamp: l.created_at as string,
      status: l.status as string,
      metadata: { ip_address: l.ip_address, user_agent: l.user_agent, location: l.location_country },
    })),
    ...riskEvents.map((r) => ({
      id: `risk-${r.id as string}`,
      type: "risk_event" as const,
      title: String(r.event_type ?? "Security Event").replace(/_/g, " "),
      description: `Risk score: ${String(r.risk_score)} — ${String(r.risk_level)}`,
      timestamp: r.created_at as string,
      severity: r.risk_level as "low" | "medium" | "high" | "critical",
      metadata: { risk_score: r.risk_score, signals: r.signals, ip_address: r.ip_address, action_taken: r.action_taken },
    })),
    ...tickets.map((t) => ({
      id: `ticket-${t.id as string}`,
      type: "support_ticket" as const,
      title: `Support Ticket: ${String(t.subject ?? "No Subject")}`,
      description: `#${String(t.ticket_number ?? "")} — ${String(t.status)}`,
      timestamp: t.created_at as string,
      status: t.status as string,
      metadata: { ticket_number: t.ticket_number, status: t.status },
    })),
    ...passwordChanges.map((p) => ({
      id: `pwd-${p.id as string}`,
      type: "password_change" as const,
      title: String(p.action ?? "Security Action").replace(/\./g, " "),
      description: "Authentication credential change detected",
      timestamp: p.created_at as string,
      metadata: (p.metadata as Record<string, unknown>) ?? {},
    })),
    ...sessions.filter((s) => s.created_at).map((s) => ({
      id: `session-${s.id as string}`,
      type: "session_created" as const,
      title: "Session Created",
      description: `${String(s.browser ?? "Unknown browser")} on ${String(s.os ?? "unknown OS")}`,
      timestamp: s.created_at as string,
      metadata: { browser: s.browser, os: s.os, device_type: s.device_type, ip_address: s.ip_address, location: s.location_country },
    })),
  ];

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    profile,
    activeSessions: sessions.filter((s) => !s.revoked_at && !s.expired_at),
    loginHistory: logins,
    riskEvents,
    supportTickets: tickets,
    timeline,
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
