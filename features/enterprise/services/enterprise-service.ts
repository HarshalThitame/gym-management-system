import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BranchPerformancePoint,
  EnterpriseDashboard,
  EnterpriseKpi,
  TenantUsagePoint
} from "@/types/enterprise";
import type { Database } from "@/types/database";
import {
  calculateUsagePercent,
  enterpriseStatusFromPercent,
  formatCompactNumber,
  formatCurrency,
  healthStatus
} from "../lib/business-rules";

type BranchLatestRow = Database["public"]["Views"]["enterprise_branch_metrics_latest"]["Row"];
type TenantUsageRow = Database["public"]["Views"]["enterprise_tenant_usage_summary"]["Row"];
type HealthCheckRow = Database["public"]["Tables"]["system_health_checks"]["Row"];

export async function getEnterpriseDashboard(): Promise<EnterpriseDashboard> {
  const supabase = await createSupabaseServerClient();

  const [
    organizationsResult,
    branchesResult,
    branchSettingsResult,
    branchUsersResult,
    branchMetricsResult,
    tenantConfigsResult,
    featureFlagsResult,
    subscriptionsResult,
    activityEventsResult,
    securityEventsResult,
    complianceRequestsResult,
    retentionPoliciesResult,
    backupJobsResult,
    healthChecksResult,
    documentationResult,
    branchLatestResult,
    tenantUsageResult,
    securitySummaryResult
  ] = await Promise.all([
    supabase.from("organizations").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("branches").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("branch_settings").select("*").order("updated_at", { ascending: false }).limit(100),
    supabase.from("branch_users").select("*").order("updated_at", { ascending: false }).limit(500),
    supabase.from("branch_metrics").select("*").order("metric_date", { ascending: false }).limit(1000),
    supabase.from("tenant_configs").select("*").order("updated_at", { ascending: false }).limit(100),
    supabase.from("feature_flags").select("*").order("updated_at", { ascending: false }).limit(200),
    supabase.from("platform_subscriptions").select("*").order("updated_at", { ascending: false }).limit(100),
    supabase.from("activity_events").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("security_events").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("compliance_requests").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("retention_policies").select("*").order("data_category", { ascending: true }).limit(80),
    supabase.from("backup_jobs").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("system_health_checks").select("*").order("checked_at", { ascending: false }).limit(100),
    supabase.from("documentation_articles").select("*").eq("status", "published").order("audience", { ascending: true }).order("title", { ascending: true }).limit(100),
    supabase.from("enterprise_branch_metrics_latest").select("*").order("branch_name", { ascending: true }).limit(500),
    supabase.from("enterprise_tenant_usage_summary").select("*").order("organization_name", { ascending: true }).limit(100),
    supabase.from("enterprise_security_summary").select("*").limit(100)
  ]);

  const firstError = [
    organizationsResult,
    branchesResult,
    branchSettingsResult,
    branchUsersResult,
    branchMetricsResult,
    tenantConfigsResult,
    featureFlagsResult,
    subscriptionsResult,
    activityEventsResult,
    securityEventsResult,
    complianceRequestsResult,
    retentionPoliciesResult,
    backupJobsResult,
    healthChecksResult,
    documentationResult,
    branchLatestResult,
    tenantUsageResult,
    securitySummaryResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const organizations = organizationsResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const tenantUsage = tenantUsageResult.data ?? [];
  const featureFlags = featureFlagsResult.data ?? [];
  const securityEvents = securityEventsResult.data ?? [];
  const complianceRequests = complianceRequestsResult.data ?? [];
  const backupJobs = backupJobsResult.data ?? [];
  const healthChecks = healthChecksResult.data ?? [];
  const branchLatestMetrics = branchLatestResult.data ?? [];
  const branchPerformance = buildBranchPerformance(branchLatestMetrics);
  const tenantUsagePoints = buildTenantUsagePoints(tenantUsage);
  const openSecurityEvents = securityEvents.filter((event) => event.status === "open" || event.status === "investigating");
  const openCompliance = complianceRequests.filter((request) => request.status === "open" || request.status === "in_review");
  const failedBackups = backupJobs.filter((job) => job.status === "failed").length;
  const enabledFlags = featureFlags.filter((flag) => flag.enabled && flag.status === "active").length;
  const health = healthStatus(healthChecks.slice(0, 16).map((check) => ({ status: check.status })));
  const storageRisk = Math.max(...tenantUsagePoints.map((row) => row.storagePercent), 0);
  const revenue = sum(branchLatestMetrics.map((row) => Number(row.revenue_amount ?? 0)));

  return {
    kpis: [
      kpi("organizations", "Organizations", formatCompactNumber(organizations.length), `${branches.length} branches in scope`, "good"),
      kpi("active_branches", "Active Branches", formatCompactNumber(branches.filter((branch) => branch.status === "active").length), "Operational branches", "good"),
      kpi("tenant_revenue", "Latest Revenue", formatCurrency(revenue), "Latest branch metric snapshot", "good"),
      kpi("feature_flags", "Enabled Flags", formatCompactNumber(enabledFlags), `${featureFlags.length} total feature controls`, enabledFlags > 0 ? "good" : "watch"),
      kpi("security_events", "Security Events", formatCompactNumber(openSecurityEvents.length), "Open or investigating events", openSecurityEvents.length > 0 ? "risk" : "good"),
      kpi("compliance", "Compliance Queue", formatCompactNumber(openCompliance.length), "Open privacy and consent workflows", openCompliance.length > 0 ? "watch" : "good"),
      kpi("backups", "Backup Failures", formatCompactNumber(failedBackups), "Failed backup jobs", failedBackups > 0 ? "risk" : "good"),
      kpi("system_health", "System Health", health === "good" ? "Healthy" : health === "watch" ? "Degraded" : "Action", `${healthChecks.length} recent checks`, health),
      kpi("storage", "Storage Risk", `${storageRisk}%`, "Highest tenant storage utilization", enterpriseStatusFromPercent(storageRisk))
    ],
    organizations,
    branches,
    branchSettings: branchSettingsResult.data ?? [],
    branchUsers: branchUsersResult.data ?? [],
    branchMetrics: branchMetricsResult.data ?? [],
    tenantConfigs: tenantConfigsResult.data ?? [],
    featureFlags,
    subscriptions: subscriptionsResult.data ?? [],
    activityEvents: activityEventsResult.data ?? [],
    securityEvents,
    complianceRequests,
    retentionPolicies: retentionPoliciesResult.data ?? [],
    backupJobs,
    healthChecks,
    documentationArticles: documentationResult.data ?? [],
    branchLatestMetrics,
    tenantUsage,
    securitySummary: securitySummaryResult.data ?? [],
    branchPerformance,
    tenantUsagePoints
  };
}

function buildBranchPerformance(rows: BranchLatestRow[]): BranchPerformancePoint[] {
  return rows.map((row) => ({
    branchName: row.branch_name ?? "Branch",
    revenue: Number(row.revenue_amount ?? 0),
    members: Number(row.active_members ?? 0),
    attendance: Number(row.attendance_count ?? 0),
    trainerUtilization: Number(row.trainer_utilization ?? 0),
    classUtilization: Number(row.class_utilization ?? 0)
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 12);
}

function buildTenantUsagePoints(rows: TenantUsageRow[]): TenantUsagePoint[] {
  return rows.map((row) => ({
    organizationName: row.organization_name ?? "Organization",
    branches: Number(row.branches ?? 0),
    activeMembers: Number(row.active_members ?? 0),
    storagePercent: calculateUsagePercent(Number(row.storage_mb ?? 0), row.storage_limit_mb),
    branchPercent: calculateUsagePercent(Number(row.branches ?? 0), row.branch_limit),
    memberPercent: calculateUsagePercent(Number(row.active_members ?? 0), row.member_limit)
  })).sort((a, b) => b.activeMembers - a.activeMembers).slice(0, 12);
}

function kpi(key: string, label: string, value: string, detail: string, status: EnterpriseKpi["status"]): EnterpriseKpi {
  return { key, label, value, detail, status };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function latestHealthByComponent(checks: HealthCheckRow[]) {
  const byComponent = new Map<string, HealthCheckRow>();
  for (const check of checks) {
    if (!byComponent.has(check.component)) {
      byComponent.set(check.component, check);
    }
  }
  return Array.from(byComponent.values());
}
