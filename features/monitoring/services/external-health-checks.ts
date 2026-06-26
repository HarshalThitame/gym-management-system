import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSecurityIncident } from "@/features/security/services/security-incident-service";

export type ExternalServiceStatus = "up" | "down" | "degraded";

export type ExternalHealthCheckResult = {
  service: string;
  label: string;
  status: ExternalServiceStatus;
  latency: number;
  lastChecked: string;
  error: string | null;
  uptimePercent?: number;
};

export type ExternalHealthCheckHistory = {
  id: string;
  service: string;
  status: ExternalServiceStatus;
  latencyMs: number;
  errorMessage: string | null;
  checkedAt: string;
};

const FAST_CHECK_INTERVAL = 60 * 1000;
const SLOW_CHECK_INTERVAL = 5 * 60 * 1000;

const cache = new Map<string, { result: ExternalHealthCheckResult; history: ExternalHealthCheckHistory[] }>();
const lastRun = new Map<string, number>();
const previousStatuses = new Map<string, ExternalServiceStatus>();
const incidentCache = new Map<string, { incidentId: string; createdAt: string }>();

function isFastCheck(service: string): boolean {
  const fast = ["supabase_api", "database", "dns"];
  return fast.includes(service);
}

function shouldRun(service: string): boolean {
  const now = Date.now();
  const last = lastRun.get(service) ?? 0;
  const interval = isFastCheck(service) ? FAST_CHECK_INTERVAL : SLOW_CHECK_INTERVAL;
  return now - last >= interval;
}

async function ping(url: string, options: { method?: string; headers?: Record<string, string>; timeout?: number } = {}): Promise<{ ok: boolean; latency: number; status: number; error?: string }> {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = options.timeout ?? 10000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: { ...options.headers },
      signal: controller.signal,
    });
    const latency = Math.round(performance.now() - start);
    return { ok: res.ok, latency, status: res.status };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { ok: false, latency, status: 0, error: err.message ?? "Unknown error" };
  } finally {
    clearTimeout(timer);
  }
}

async function checkSupabaseApi(): Promise<ExternalHealthCheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { service: "supabase_api", label: "Supabase API", status: "down", latency: 0, lastChecked: new Date().toISOString(), error: "Supabase URL or service key not configured" };
  }
  const result = await ping(`${url}/rest/v1/`, { headers: { "apikey": key } });
  return {
    service: "supabase_api",
    label: "Supabase API",
    status: result.ok ? "up" : "down",
    latency: result.latency,
    lastChecked: new Date().toISOString(),
    error: result.ok ? null : `Status ${result.status}: ${result.error ?? "Unreachable"}`,
  };
}

async function checkRazorpay(): Promise<ExternalHealthCheckResult> {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) {
    return { service: "razorpay", label: "Razorpay", status: "down", latency: 0, lastChecked: new Date().toISOString(), error: "Razorpay credentials not configured" };
  }
  const encoded = Buffer.from(`${key}:${secret}`).toString("base64");
  const result = await ping("https://api.razorpay.com/v1/payments?count=1", { headers: { "Authorization": `Basic ${encoded}` } });
  return {
    service: "razorpay",
    label: "Razorpay",
    status: result.ok ? "up" : "down",
    latency: result.latency,
    lastChecked: new Date().toISOString(),
    error: result.ok ? null : `Status ${result.status}: ${result.error ?? "Unreachable"}`,
  };
}

async function checkResend(): Promise<ExternalHealthCheckResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { service: "resend", label: "Resend", status: "down", latency: 0, lastChecked: new Date().toISOString(), error: "Resend API key not configured" };
  }
  const result = await ping("https://api.resend.com/emails", { headers: { "Authorization": `Bearer ${key}` } });
  return {
    service: "resend",
    label: "Resend",
    status: result.ok ? "up" : "down",
    latency: result.latency,
    lastChecked: new Date().toISOString(),
    error: result.ok ? null : `Status ${result.status}: ${result.error ?? "Unreachable"}`,
  };
}

async function checkOpenAI(): Promise<ExternalHealthCheckResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { service: "openai", label: "OpenAI", status: "down", latency: 0, lastChecked: new Date().toISOString(), error: "OpenAI API key not configured" };
  }
  const result = await ping("https://api.openai.com/v1/models", { headers: { "Authorization": `Bearer ${key}` } });
  return {
    service: "openai",
    label: "OpenAI",
    status: result.ok ? "up" : "down",
    latency: result.latency,
    lastChecked: new Date().toISOString(),
    error: result.ok ? null : `Status ${result.status}: ${result.error ?? "Unreachable"}`,
  };
}

async function checkVercel(): Promise<ExternalHealthCheckResult> {
  const token = process.env.VERCEL_TOKEN ?? process.env.VERCEL_API_TOKEN;
  if (!token) {
    return { service: "vercel", label: "Vercel", status: "down", latency: 0, lastChecked: new Date().toISOString(), error: "Vercel token not configured" };
  }
  const result = await ping("https://api.vercel.com/v1/deployments?limit=1", { headers: { "Authorization": `Bearer ${token}` } });
  return {
    service: "vercel",
    label: "Vercel",
    status: result.ok ? "up" : "down",
    latency: result.latency,
    lastChecked: new Date().toISOString(),
    error: result.ok ? null : `Status ${result.status}: ${result.error ?? "Unreachable"}`,
  };
}

async function checkDNS(): Promise<ExternalHealthCheckResult> {
  const start = performance.now();
  try {
    const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "https://apexperformance.club";
    const hostname = new URL(url).hostname;
    const { Resolver } = await import("dns/promises");
    const resolver = new Resolver();
    await resolver.resolve4(hostname);
    const latency = Math.round(performance.now() - start);
    return { service: "dns", label: "DNS Resolution", status: "up", latency, lastChecked: new Date().toISOString(), error: null };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { service: "dns", label: "DNS Resolution", status: "down", latency, lastChecked: new Date().toISOString(), error: err.message ?? "DNS resolution failed" };
  }
}

async function checkSSL(): Promise<ExternalHealthCheckResult> {
  const start = performance.now();
  try {
    const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "https://apexperformance.club";
    const hostname = new URL(url).hostname;
    const tls = await import("tls");
    const cert = await new Promise<{ daysRemaining: number }>((resolve, reject) => {
      const socket = tls.connect(443, hostname, { servername: hostname, rejectUnauthorized: false }, () => {
        const cert = socket.getPeerCertificate();
        if (cert.valid_to) {
          const daysRemaining = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          socket.end();
          resolve({ daysRemaining });
        } else {
          socket.end();
          reject(new Error("No certificate found"));
        }
      });
      socket.on("error", reject);
      socket.setTimeout(10000, () => { socket.destroy(); reject(new Error("Timeout")); });
    });
    const latency = Math.round(performance.now() - start);
    const status = cert.daysRemaining > 30 ? "up" : cert.daysRemaining > 7 ? "degraded" : "down";
    return {
      service: "ssl", label: "SSL Certificate", status, latency, lastChecked: new Date().toISOString(),
      error: status === "degraded" ? `Certificate expires in ${cert.daysRemaining} days` : status === "down" ? `Certificate expires in ${cert.daysRemaining} days` : null,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { service: "ssl", label: "SSL Certificate", status: "down", latency, lastChecked: new Date().toISOString(), error: err.message ?? "SSL check failed" };
  }
}

async function checkDatabaseConnection(): Promise<ExternalHealthCheckResult> {
  const start = performance.now();
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return { service: "database", label: "Database Connection", status: "down", latency: 0, lastChecked: new Date().toISOString(), error: "Supabase client not configured" };
    }
    const { error } = await supabase.from("organizations").select("id", { count: "exact", head: true }).limit(1);
    const latency = Math.round(performance.now() - start);
    if (error) {
      return { service: "database", label: "Database Connection", status: "down", latency, lastChecked: new Date().toISOString(), error: error.message };
    }
    return { service: "database", label: "Database Connection", status: "up", latency, lastChecked: new Date().toISOString(), error: null };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { service: "database", label: "Database Connection", status: "down", latency, lastChecked: new Date().toISOString(), error: err.message ?? "DB check failed" };
  }
}

async function persistResults(results: ExternalHealthCheckResult[]): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    const rows = results.map((r) => ({
      service: r.service,
      status: r.status,
      latency_ms: r.latency,
      error_message: r.error ?? null,
      checked_at: r.lastChecked,
    }));
    await (supabase as any).from("monitoring_external_health_checks").insert(rows);
  } catch {
    // Non-critical - logs can fail silently
  }
}

async function loadHistory(service: string): Promise<ExternalHealthCheckHistory[]> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("monitoring_external_health_checks")
      .select("id, service, status, latency_ms, error_message, checked_at")
      .eq("service", service)
      .order("checked_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      service: r.service,
      status: r.status,
      latencyMs: r.latency_ms,
      errorMessage: r.error_message,
      checkedAt: r.checked_at,
    }));
  } catch {
    return [];
  }
}

const serviceCriticality: Record<string, string> = {
  supabase_api: "critical",
  database: "critical",
  razorpay: "high",
  resend: "high",
  openai: "high",
  vercel: "high",
  dns: "high",
  ssl: "medium",
};

async function checkAndCreateIncident(service: string, newStatus: ExternalServiceStatus): Promise<void> {
  const prev = previousStatuses.get(service);
  if (prev && prev !== "down" && newStatus === "down") {
    const alreadyAlerted = incidentCache.get(service);
    if (alreadyAlerted && Date.now() - new Date(alreadyAlerted.createdAt).getTime() < 5 * 60 * 1000) return;
    try {
      const severity = serviceCriticality[service] ?? "high";
      const incident = await createSecurityIncident({
        eventType: "monitoring_alert",
        severity: severity as "critical" | "high" | "medium" | "low",
        description: `[Auto-detected] Health check failed for "${service}" — status transitioned from "${prev}" to "down".`,
        metadata: { service, previousStatus: prev, newStatus, source: "external-health-checks" },
      });
      if (incident) {
        incidentCache.set(service, { incidentId: incident.id, createdAt: new Date().toISOString() });
      }
    } catch (err) {
      console.error(`[external-health-checks] Failed to create incident for ${service}:`, err);
    }
  }
}

export function getIncidentReference(service: string): { incidentId: string; createdAt: string } | undefined {
  return incidentCache.get(service);
}

export async function runExternalHealthCheck(serviceName: string): Promise<ExternalHealthCheckResult> {
  const checkFn = checkFunctions.get(serviceName);
  if (!checkFn) {
    return { service: serviceName, label: serviceName, status: "down", latency: 0, lastChecked: new Date().toISOString(), error: "Unknown check" };
  }
  const result = await checkFn();
  previousStatuses.set(serviceName, result.status);
  checkAndCreateIncident(serviceName, result.status);
  cache.set(serviceName, { result, history: [] });
  lastRun.set(serviceName, Date.now());
  return result;
}

const checkFunctions = new Map<string, () => Promise<ExternalHealthCheckResult>>([
  ["supabase_api", checkSupabaseApi],
  ["razorpay", checkRazorpay],
  ["resend", checkResend],
  ["openai", checkOpenAI],
  ["vercel", checkVercel],
  ["dns", checkDNS],
  ["ssl", checkSSL],
  ["database", checkDatabaseConnection],
]);

export async function runAllExternalHealthChecks(): Promise<ExternalHealthCheckResult[]> {
  const services = ["supabase_api", "razorpay", "resend", "openai", "vercel", "dns", "ssl", "database"];
  const results: ExternalHealthCheckResult[] = [];

  for (const service of services) {
    if (!shouldRun(service)) {
      const cached = cache.get(service);
      if (cached) {
        results.push(cached.result);
        continue;
      }
    }
    const checkFn = checkFunctions.get(service);
    if (!checkFn) continue;
    const result = await checkFn();
    previousStatuses.set(service, result.status);
    checkAndCreateIncident(service, result.status);
    cache.set(service, { result, history: [] });
    lastRun.set(service, Date.now());
    results.push(result);
  }

  // Persist new results to DB (non-blocking)
  const newResults = results.filter((r) => cache.get(r.service)?.result.lastChecked === r.lastChecked);
  if (newResults.length > 0) {
    persistResults(newResults);
  }

  return results;
}

export async function getExternalHealthCheckResults(): Promise<ExternalHealthCheckResult[]> {
  const services = ["supabase_api", "razorpay", "resend", "openai", "vercel", "dns", "ssl", "database"];
  const results: ExternalHealthCheckResult[] = [];

  for (const service of services) {
    const cached = cache.get(service);
    if (cached) {
      results.push(cached.result);
    } else {
      const checkFn = checkFunctions.get(service);
      if (!checkFn) continue;
      const result = await checkFn();
      previousStatuses.set(service, result.status);
      checkAndCreateIncident(service, result.status);
      cache.set(service, { result, history: [] });
      lastRun.set(service, Date.now());
      results.push(result);
    }
  }

  return results;
}

export async function getExternalHealthCheckHistory(service: string): Promise<ExternalHealthCheckHistory[]> {
  const cached = cache.get(service);
  if (cached && cached.history.length > 0) return cached.history;
  const history = await loadHistory(service);
  const existing = cached ?? { result: { service, label: service, status: "up" as const, latency: 0, lastChecked: new Date().toISOString(), error: null }, history: [] as ExternalHealthCheckHistory[] };
  cache.set(service, { ...existing, history });
  return history;
}

const sparklineCache = new Map<string, { timestamp: number; latency: number }[]>();

export async function getSparklineData(service: string, hours: number = 24): Promise<{ timestamp: number; latency: number }[]> {
  const cached = sparklineCache.get(service);
  if (cached) return cached;
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data } = await (supabase as any)
      .from("monitoring_external_health_checks")
      .select("latency_ms, checked_at")
      .eq("service", service)
      .gte("checked_at", since)
      .order("checked_at", { ascending: true });
    const points = (data ?? []).map((r: any) => ({ timestamp: new Date(r.checked_at).getTime(), latency: r.latency_ms }));
    sparklineCache.set(service, points);
    return points;
  } catch {
    return [];
  }
}

export type IncidentReference = {
  incidentId: string;
  service: string;
  severity: string;
  createdAt: string;
};

export async function getRecentIncidents(limit: number = 20): Promise<IncidentReference[]> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("security_events")
      .select("id, event_type, severity, created_at, description, metadata")
      .eq("event_type", "monitoring_alert")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((r: any) => ({
      incidentId: r.id,
      service: r.metadata?.service ?? "unknown",
      severity: r.severity,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function getUptimePercent(service: string, hours: number = 24): Promise<number> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return 100;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, count } = await (supabase as any)
      .from("monitoring_external_health_checks")
      .select("status", { count: "exact" })
      .eq("service", service)
      .gte("checked_at", since);
    if (!count || count === 0) return 100;
    const up = (data ?? []).filter((r: any) => r.status === "up").length;
    return Math.round((up / count) * 100);
  } catch {
    return 100;
  }
}
