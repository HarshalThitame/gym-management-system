/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAllExternalHealthChecks, getRecentIncidents, getUptimePercent } from "./external-health-checks";
import type { ExternalHealthCheckResult, IncidentReference } from "./external-health-checks";

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type HealthCheck = {
  component: string;
  label: string;
  status: HealthStatus;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  message: string | null;
};

export type UsageOverview = {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  trialOrganizations: number;
  totalBranches: number;
  activeBranches: number;
  totalUsers: number;
  totalMembers: number;
  totalTrainers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
};

export type SubscriptionMonitoring = {
  activeSubscriptions: number;
  expiredSubscriptions: number;
  trialSubscriptions: number;
  suspendedSubscriptions: number;
  cancelledSubscriptions: number;
  renewalDueSoon: number;
  orgsWithoutSubscription: number;
};

export type SystemActivity = {
  recentLogins: number;
  recentSecurityEvents: number;
  recentErrors: number;
  recentActivityEvents: Array<{
    id: string;
    eventType: string;
    entityType: string;
    severity: string;
    createdAt: string;
    actorId: string | null;
  }>;
};

export type SecuritySummary = {
  failedLogins24h: number;
  totalLogins24h: number;
  openSecurityEvents: number;
  criticalSecurityEvents: number;
  recentEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    status: string;
    description: string;
    createdAt: string;
  }>;
};

export type ErrorSummary = {
  totalErrors: number;
  unresolvedErrors: number;
  criticalErrors: number;
  recentErrors: Array<{
    id: string;
    type: string;
    message: string;
    severity: string;
    service: string;
    frequency: number;
    lastSeen: string;
    isResolved: boolean;
  }>;
};

export type DataIntegrityIssue = {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  label: string;
  description: string;
  count: number;
};

export type MonitoringDashboard = {
  platformHealth: HealthCheck[];
  externalHealth: ExternalHealthCheckResult[];
  incidentReferences: IncidentReference[];
  usage: UsageOverview;
  subscriptions: SubscriptionMonitoring;
  activity: SystemActivity;
  security: SecuritySummary;
  errors: ErrorSummary;
  dataIntegrity: DataIntegrityIssue[];
  fetchedAt: string;
  error: string | null;
};

function getFetchedAt(): string {
  return new Date().toISOString();
}

export async function getMonitoringDashboard(): Promise<MonitoringDashboard> {
  const supabase = getSupabaseAdminClient();
  let externalHealth: ExternalHealthCheckResult[] = [];

  try {
    externalHealth = await runAllExternalHealthChecks();
    externalHealth = await Promise.all(
      externalHealth.map(async (h) => ({
        ...h,
        uptimePercent: await getUptimePercent(h.service, 24),
      }))
    );
  } catch {
    // Non-critical - external health checks can fail independently
  }

  if (!supabase) {
    return {
      platformHealth: [
        { component: "database", label: "Database Connection", status: "down", latencyMs: null, lastCheckedAt: null, message: "Supabase client not configured" },
      ],
      externalHealth,
      incidentReferences: [],
      usage: {
        totalOrganizations: 0, activeOrganizations: 0, suspendedOrganizations: 0, trialOrganizations: 0,
        totalBranches: 0, activeBranches: 0, totalUsers: 0, totalMembers: 0, totalTrainers: 0,
        totalSubscriptions: 0, activeSubscriptions: 0,
      },
      subscriptions: {
        activeSubscriptions: 0, expiredSubscriptions: 0, trialSubscriptions: 0,
        suspendedSubscriptions: 0, cancelledSubscriptions: 0, renewalDueSoon: 0, orgsWithoutSubscription: 0,
      },
      activity: { recentLogins: 0, recentSecurityEvents: 0, recentErrors: 0, recentActivityEvents: [] },
      security: { failedLogins24h: 0, totalLogins24h: 0, openSecurityEvents: 0, criticalSecurityEvents: 0, recentEvents: [] },
      errors: { totalErrors: 0, unresolvedErrors: 0, criticalErrors: 0, recentErrors: [] },
      dataIntegrity: [],
      fetchedAt: getFetchedAt(),
      error: "Database connection not available",
    };
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const [
      orgResult,
      branchResult,
      profileResult,
      memberResult,
      trainerResult,
      subResult,
      healthResult,
      activityResult,
      securityResult,
      errorResult,
      loginResult,
    ] = await Promise.all([
      supabase.from("organizations").select("id, status"),
      supabase.from("branches").select("id, status"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("members").select("*", { count: "exact", head: true }),
      supabase.from("trainers").select("*", { count: "exact", head: true }),
      supabase.from("organization_subscriptions").select("id, organization_id, package_id, status, expires_at"),
      supabase.from("system_health_checks").select("component, status, latency_ms, message, checked_at").order("checked_at", { ascending: false }).limit(50),
      supabase.from("activity_events").select("id, event_type, entity_type, severity, created_at, actor_id").order("created_at", { ascending: false }).limit(20),
      supabase.from("security_events").select("id, event_type, severity, status, description, created_at").order("created_at", { ascending: false }).limit(20),
      (supabase as any).from("observability_errors").select("id, error_type, error_message, severity, service_name, frequency, last_seen_at, is_resolved").order("last_seen_at", { ascending: false }).limit(20),
      (supabase as any).from("login_history").select("id, status, created_at").gte("created_at", twentyFourHoursAgo),
    ]);

    const checkError = [orgResult, branchResult, profileResult, memberResult, trainerResult, subResult, healthResult, activityResult, securityResult, errorResult, loginResult]
      .find((r) => r.error)?.error;

    if (checkError) {
      console.error("[monitoring-service] Query error:", checkError.message);
    }

    const organizations = orgResult.data ?? [];
    const branches = branchResult.data ?? [];
    const subscriptions = subResult.data ?? [];
    const healthChecks = healthResult.data ?? [];
    const activityEvents = activityResult.data ?? [];
    const securityEvents = securityResult.data ?? [];
    const errors = errorResult.data ?? [];
    const logins = loginResult.data ?? [];

    const platformHealth: HealthCheck[] = buildHealthChecks(healthChecks);

    const usage: UsageOverview = {
      totalOrganizations: organizations.length,
      activeOrganizations: organizations.filter((o: any) => o.status === "active").length,
      suspendedOrganizations: organizations.filter((o: any) => o.status === "suspended").length,
      trialOrganizations: organizations.filter((o: any) => o.status === "trial").length,
      totalBranches: branches.length,
      activeBranches: branches.filter((b: any) => b.status === "active").length,
      totalUsers: profileResult.count ?? 0,
      totalMembers: memberResult.count ?? 0,
      totalTrainers: trainerResult.count ?? 0,
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter((s: any) => s.status === "active").length,
    };

    const subscriptionsData: SubscriptionMonitoring = {
      activeSubscriptions: subscriptions.filter((s: any) => s.status === "active").length,
      expiredSubscriptions: subscriptions.filter((s: any) => s.status === "expired").length,
      trialSubscriptions: subscriptions.filter((s: any) => s.status === "trial").length,
      suspendedSubscriptions: subscriptions.filter((s: any) => s.status === "suspended").length,
      cancelledSubscriptions: subscriptions.filter((s: any) => s.status === "cancelled").length,
      renewalDueSoon: subscriptions.filter((s: any) => {
        if (!s.expires_at) return false;
        const expiresAt = new Date(s.expires_at).getTime();
        const in7Days = now.getTime() + 7 * 24 * 60 * 60 * 1000;
        return s.status === "active" && expiresAt <= in7Days;
      }).length,
      orgsWithoutSubscription: organizations.filter((o: any) => !subscriptions.some((s: any) => s.organization_id === o.id)).length,
    };

    const activity: SystemActivity = {
      recentLogins: logins.length,
      recentSecurityEvents: securityEvents.length,
      recentErrors: errors.filter((e: any) => !e.is_resolved).length,
      recentActivityEvents: activityEvents.slice(0, 10).map((a: any) => ({
        id: a.id,
        eventType: a.event_type,
        entityType: a.entity_type,
        severity: a.severity,
        createdAt: a.created_at,
        actorId: a.actor_id,
      })),
    };

    const security: SecuritySummary = {
      failedLogins24h: logins.filter((l: any) => l.status === "failed").length,
      totalLogins24h: logins.length,
      openSecurityEvents: securityEvents.filter((s: any) => s.status === "open" || s.status === "investigating").length,
      criticalSecurityEvents: securityEvents.filter((s: any) => s.severity === "critical" || s.severity === "high").length,
      recentEvents: securityEvents.slice(0, 10).map((s: any) => ({
        id: s.id,
        eventType: s.event_type,
        severity: s.severity,
        status: s.status,
        description: s.description,
        createdAt: s.created_at,
      })),
    };

    const errorSummary: ErrorSummary = {
      totalErrors: errors.length,
      unresolvedErrors: errors.filter((e: any) => !e.is_resolved).length,
      criticalErrors: errors.filter((e: any) => e.severity === "critical" || e.severity === "high").length,
      recentErrors: errors.slice(0, 10).map((e: any) => ({
        id: e.id,
        type: e.error_type,
        message: e.error_message,
        severity: e.severity,
        service: e.service_name ?? "Unknown",
        frequency: e.frequency,
        lastSeen: e.last_seen_at,
        isResolved: e.is_resolved,
      })),
    };

    const [dataIntegrity, incidentReferences] = await Promise.all([
      buildDataIntegrityIssues(supabase, organizations, subscriptions),
      getRecentIncidents(20),
    ]);

    return {
      platformHealth,
      externalHealth,
      incidentReferences,
      usage,
      subscriptions: subscriptionsData,
      activity,
      security,
      errors: errorSummary,
      dataIntegrity,
      fetchedAt: getFetchedAt(),
      error: checkError ? checkError.message : null,
    };
  } catch (err: any) {
    console.error("[monitoring-service] Fatal error:", err.message);
    return {
      platformHealth: [
        { component: "system", label: "Monitoring System", status: "down", latencyMs: null, lastCheckedAt: null, message: err.message },
      ],
      externalHealth,
      incidentReferences: [],
      usage: {
        totalOrganizations: 0, activeOrganizations: 0, suspendedOrganizations: 0, trialOrganizations: 0,
        totalBranches: 0, activeBranches: 0, totalUsers: 0, totalMembers: 0, totalTrainers: 0,
        totalSubscriptions: 0, activeSubscriptions: 0,
      },
      subscriptions: {
        activeSubscriptions: 0, expiredSubscriptions: 0, trialSubscriptions: 0,
        suspendedSubscriptions: 0, cancelledSubscriptions: 0, renewalDueSoon: 0, orgsWithoutSubscription: 0,
      },
      activity: { recentLogins: 0, recentSecurityEvents: 0, recentErrors: 0, recentActivityEvents: [] },
      security: { failedLogins24h: 0, totalLogins24h: 0, openSecurityEvents: 0, criticalSecurityEvents: 0, recentEvents: [] },
      errors: { totalErrors: 0, unresolvedErrors: 0, criticalErrors: 0, recentErrors: [] },
      dataIntegrity: [],
      fetchedAt: getFetchedAt(),
      error: err.message,
    };
  }
}

function buildHealthChecks(rows: any[]): HealthCheck[] {
  const componentMap = new Map<string, any>();
  for (const row of rows) {
    const key = row.component;
    if (!componentMap.has(key)) {
      componentMap.set(key, row);
    }
  }

  const components = ["api", "database", "auth", "storage", "queue", "email", "payments", "background_jobs"];
  return components.map((comp) => {
    const check = componentMap.get(comp);
    return {
      component: comp,
      label: componentLabel(comp),
      status: (check?.status as HealthStatus) ?? "unknown",
      latencyMs: check?.latency_ms ?? null,
      lastCheckedAt: check?.checked_at ?? null,
      message: check?.message ?? null,
    };
  });
}

function componentLabel(comp: string): string {
  const labels: Record<string, string> = {
    api: "API Gateway",
    database: "Database",
    auth: "Authentication",
    storage: "Storage",
    queue: "Background Queues",
    email: "Email Service",
    payments: "Payment Gateway",
    background_jobs: "Background Jobs",
  };
  return labels[comp] ?? comp;
}

async function buildDataIntegrityIssues(supabase: any, organizations: any[], subscriptions: any[]): Promise<DataIntegrityIssue[]> {
  const issues: DataIntegrityIssue[] = [];
  let idCounter = 0;
  const nextId = () => `integrity-${++idCounter}`;

  const orgIds = organizations.map((o: any) => o.id);

  const [branchOrgs, profilesOrgs, memberOrgs] = await Promise.all([
    orgIds.length > 0
      ? supabase.from("branches").select("organization_id").in("organization_id", orgIds)
      : { data: [] },
    orgIds.length > 0
      ? supabase.from("profiles").select("organization_id, status").in("organization_id", orgIds)
      : { data: [] },
    orgIds.length > 0
      ? supabase.from("members").select("branch_id", { count: "exact", head: true }).limit(1)
      : { data: [], count: 0 },
  ]);

  const branchesData = branchOrgs.data ?? [];
  const profilesData = profilesOrgs.data ?? [];

  if (!subscriptions.length && organizations.length > 0) {
    issues.push({
      id: nextId(),
      type: "no_subscriptions",
      severity: "critical",
      label: "No Subscription Plans Assigned",
      description: `${organizations.length} organizations exist but none have an assigned subscription plan.`,
      count: organizations.length,
    });
  }

  const orgsWithoutSub = organizations.filter((o: any) => !subscriptions.some((s: any) => s.organization_id === o.id));
  if (orgsWithoutSub.length > 0) {
    issues.push({
      id: nextId(),
      type: "orgs_without_subscription",
      severity: "high",
      label: "Organizations Without Subscription",
      description: `${orgsWithoutSub.length} active organizations have no active subscription plan assigned.`,
      count: orgsWithoutSub.length,
    });
  }

  const branchesWithoutOrg = branchesData.filter((b: any) => !orgIds.includes(b.organization_id));
  if (branchesWithoutOrg.length > 0) {
    issues.push({
      id: nextId(),
      type: "branches_without_org",
      severity: "critical",
      label: "Branches Without Organization",
      description: `${branchesWithoutOrg.length} branches have no valid parent organization.`,
      count: branchesWithoutOrg.length,
    });
  }

  const subsWithoutPackage = subscriptions.filter((s: any) => !s.package_id);
  if (subsWithoutPackage.length > 0) {
    issues.push({
      id: nextId(),
      type: "subs_without_package",
      severity: "high",
      label: "Subscriptions Without Package",
      description: `${subsWithoutPackage.length} subscriptions have no package version assigned.`,
      count: subsWithoutPackage.length,
    });
  }

  const deactivatedOrgs = organizations.filter((o: any) => o.status === "deactivated" || o.status === "archived");
  if (deactivatedOrgs.length > 0) {
    issues.push({
      id: nextId(),
      type: "deactivated_orgs",
      severity: "low",
      label: "Deactivated Organizations",
      description: `${deactivatedOrgs.length} organizations are in deactivated/archived state.`,
      count: deactivatedOrgs.length,
    });
  }

  return issues;
}
