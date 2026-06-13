import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";
import type { RiskAssessmentResult } from "@/types/enterprise";

const VPN_IPS = new Set(["1.2.3.4", "5.6.7.8"]);

export async function assessLoginRisk(userId: string, ipAddress: string, deviceFingerprint: string, userAgent: string): Promise<RiskAssessmentResult> {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const signals: Array<{ name: string; score: number; detail: string }> = [];
  let totalScore = 0;

  const { data: userSessions } = await db.from("user_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  const sessions = (userSessions ?? []) as Array<Record<string, unknown>>;

  const { data: loginHistory } = await db.from("login_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  const logins = (loginHistory ?? []) as Array<Record<string, unknown>>;

  const { data: failedRecent } = await db.from("login_history").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 3600000).toISOString());
  const failedCount = failedRecent?.count ?? 0;

  const knownDevices = (await db.from("trusted_devices").select("*").eq("user_id", userId)).data ?? [];
  const isKnownDevice = (knownDevices as Array<Record<string, unknown>>).some((d) => d.device_fingerprint === deviceFingerprint);
  if (!isKnownDevice && deviceFingerprint) {
    signals.push({ name: "new_device", score: 20, detail: "New device detected" });
    totalScore += 20;
  }

  if (sessions.length > 0 && sessions[0]) {
    const lastSession = sessions[0];
    if (lastSession.location_country) {
      signals.push({ name: "location_change", score: 15, detail: `Last login from ${lastSession.location_country as string}` });
      totalScore += 15;
    }
  }

  if (failedCount > 3) {
    signals.push({ name: "failed_attempt", score: 25, detail: `${failedCount} failed attempts in last hour` });
    totalScore += 25;
  }

  if (VPN_IPS.has(ipAddress)) {
    signals.push({ name: "vpn_detected", score: 20, detail: "VPN/proxy detected" });
    totalScore += 20;
  }

  const hour = new Date().getHours();
  if (hour < 6 || hour > 23) {
    signals.push({ name: "unusual_time", score: 10, detail: "Login at unusual hour" });
    totalScore += 10;
  }

  let riskLevel: "low" | "medium" | "high" = "low";
  if (totalScore > 70) riskLevel = "high";
  else if (totalScore > 30) riskLevel = "medium";

  let action: RiskAssessmentResult["action"] = "allowed";
  if (riskLevel === "high") action = "blocked";
  else if (riskLevel === "medium") action = "mfa_required";

  return { riskScore: Math.min(100, totalScore), riskLevel, signals, action };
}

export async function recordRiskEvent(event: {
  userId: string; organizationId?: string; eventType: string;
  riskScore: number; riskLevel: string; signals: Record<string, unknown>;
  ipAddress?: string; deviceFingerprint?: string; userAgent?: string;
  actionTaken: string;
}) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("risk_events").insert({
    user_id: event.userId,
    organization_id: event.organizationId ?? null,
    event_type: event.eventType,
    risk_score: event.riskScore,
    risk_level: event.riskLevel,
    signals: event.signals,
    ip_address: event.ipAddress ?? null,
    device_fingerprint: event.deviceFingerprint ?? null,
    user_agent: event.userAgent ?? null,
    action_taken: event.actionTaken,
  });
}

export async function getRiskTrends(days = 7) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await db.from("risk_events").select("created_at, risk_level, action_taken").gte("created_at", cutoff);
  if (!data) return [];

  const daily = new Map<string, { high: number; medium: number; blocked: number }>();
  for (const e of (data as Array<Record<string, unknown>>)) {
    const day = (e.created_at as string).slice(0, 10);
    if (!daily.has(day)) daily.set(day, { high: 0, medium: 0, blocked: 0 });
    const d = daily.get(day)!;
    if (e.risk_level === "high") d.high++;
    if (e.risk_level === "medium") d.medium++;
    if (e.action_taken === "blocked") d.blocked++;
  }

  return [...daily.entries()].map(([date, counts]) => ({ date, ...counts })).sort((a, b) => a.date.localeCompare(b.date));
}
