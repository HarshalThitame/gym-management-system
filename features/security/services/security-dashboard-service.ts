import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";
import type { EnterpriseSecurityDashboard } from "@/types/enterprise";

export async function getSecurityDashboard(): Promise<EnterpriseSecurityDashboard> {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const { data } = await db.from("enterprise_security_dashboard").select("*").single();
  const d = data as Record<string, unknown> | null;

  return {
    totalEvents: Number(d?.total_events ?? 0),
    criticalIncidents: Number(d?.critical_incidents ?? 0),
    activeIncidents: Number(d?.active_incidents ?? 0),
    logins24h: Number(d?.logins_24h ?? 0),
    failedLogins24h: Number(d?.failed_logins_24h ?? 0),
    activeSessions: Number(d?.active_sessions ?? 0),
    mfaEnrollments: Number(d?.mfa_enrollments ?? 0),
    highRiskSessions: Number(d?.high_risk_sessions ?? 0),
    activeOverrides: Number(d?.active_overrides ?? 0),
    sensitiveActions24h: Number(d?.sensitive_actions_24h ?? 0),
  };
}

export async function getSecurityKpis(dashboard: EnterpriseSecurityDashboard) {
  const score = Math.max(0, Math.min(100,
    100 -
    (dashboard.criticalIncidents * 8) -
    (dashboard.highRiskSessions * 3) -
    (dashboard.failedLogins24h > 10 ? 10 : dashboard.failedLogins24h) -
    (dashboard.activeOverrides * 15)
  ));

  return [
    { label: "Security Score", value: score, status: score >= 80 ? "good" as const : score >= 50 ? "watch" as const : "risk" as const, trend: (score > 70 ? "up" : "down") as "up" | "down" | "neutral", detail: `${dashboard.criticalIncidents} critical incidents` },
    { label: "Critical Incidents", value: dashboard.criticalIncidents, status: dashboard.criticalIncidents > 0 ? "risk" as const : "good" as const, trend: dashboard.criticalIncidents > 0 ? "up" as const : "neutral" as const, detail: "Requires immediate attention" },
    { label: "Active Incidents", value: dashboard.activeIncidents, status: dashboard.activeIncidents > 5 ? "risk" as const : dashboard.activeIncidents > 0 ? "watch" as const : "good" as const, trend: dashboard.activeIncidents > 0 ? "up" as const : "neutral" as const, detail: `${dashboard.activeIncidents} open incidents` },
    { label: "Failed Logins (24h)", value: dashboard.failedLogins24h, status: dashboard.failedLogins24h > 20 ? "risk" as const : dashboard.failedLogins24h > 5 ? "watch" as const : "good" as const, trend: dashboard.failedLogins24h > 10 ? "up" as const : "neutral" as const, detail: "Suspicious activity" },
    { label: "MFA Enrollment", value: dashboard.mfaEnrollments, status: dashboard.mfaEnrollments > 0 ? "good" as const : "risk" as const, trend: dashboard.mfaEnrollments > 100 ? "up" as const : "neutral" as const, detail: `${dashboard.mfaEnrollments} enrolled users` },
    { label: "Active Sessions", value: dashboard.activeSessions, status: "good" as const, trend: "neutral" as const, detail: `${dashboard.highRiskSessions} high risk` },
  ];
}

export async function getRecentSecurityEvents(limit = 20) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data } = await db
    .from("security_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function getTenantRiskRanking() {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data: events } = await db.from("security_events").select("organization_id, severity, status").limit(5000);
  if (!events) return [];

  const eventsList = events as Array<Record<string, unknown>>;
  const orgMap = new Map<string, { total: number; critical: number; open: number }>();

  for (const e of eventsList) {
    const orgId = e.organization_id as string | null;
    if (!orgId) continue;
    if (!orgMap.has(orgId)) orgMap.set(orgId, { total: 0, critical: 0, open: 0 });
    const entry = orgMap.get(orgId)!;
    entry.total++;
    if (e.severity === "critical") entry.critical++;
    if (e.status === "open" || e.status === "investigating") entry.open++;
  }

  return [...orgMap.entries()]
    .map(([orgId, stats]) => ({ organizationId: orgId, ...stats, riskScore: Math.min(100, stats.critical * 30 + stats.open * 10) }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}
