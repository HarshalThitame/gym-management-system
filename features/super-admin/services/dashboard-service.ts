import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type { EnterpriseDashboard, EnterpriseKpi } from "@/types/enterprise";
import type { OrgSubscriptionSummary } from "./subscription-service";

export const dashboardDateRangeKeys = ["today", "7d", "30d", "month", "quarter", "year", "custom"] as const;

export type DashboardDateRangeKey = (typeof dashboardDateRangeKeys)[number];

export type DashboardDateRange = {
  key: DashboardDateRangeKey;
  label: string;
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
};

export type DashboardThresholds = {
  readiness: {
    good: number;
    watch: number;
    criticalSecurityPenalty: number;
    criticalSecurityCap: number;
    downHealthPenalty: number;
    downHealthCap: number;
    degradedHealthPenalty: number;
    degradedHealthCap: number;
    failedBackupPenalty: number;
    failedBackupCap: number;
    failedDomainPenalty: number;
    failedDomainCap: number;
    hardBlockedSubscriptionPenalty: number;
    hardBlockedSubscriptionCap: number;
    unassignedSubscriptionPenalty: number;
    unassignedSubscriptionCap: number;
    overdueCompliancePenalty: number;
    overdueComplianceCap: number;
  };
  usage: {
    watch: number;
    risk: number;
  };
  freshness: {
    warningMinutes: number;
    staleMinutes: number;
  };
  slo: {
    uptimeTargetPercent: number;
    apiP95MsTarget: number;
    databaseP95MsTarget: number;
    queueLagMsTarget: number;
    errorRateTargetPercent: number;
    webhookFailureTarget: number;
  };
};

export type DashboardFinanceSummary = {
  grossRevenue: number;
  netRevenue: number;
  refundAmount: number;
  taxCollected: number;
  discounts: number;
  outstandingAmount: number;
  paidPayments: number;
  failedPayments: number;
  invoicesIssued: number;
  invoicesPaid: number;
  refundsProcessed: number;
  reconciliationIssues: number;
  webhookFailures: number;
  lastLedgerAt: string | null;
  sourceLabel: string;
};

export type DashboardFreshnessSource = {
  label: string;
  source: string;
  lastUpdatedAt: string | null;
  ageMinutes: number | null;
  status: EnterpriseKpi["status"];
};

export type DashboardSloSummary = {
  uptimePercent: number;
  errorRatePercent: number;
  apiP95Ms: number | null;
  databaseP95Ms: number | null;
  queueLagMs: number | null;
  failedJobs: number;
  webhookFailures: number;
  status: EnterpriseKpi["status"];
};

export type DashboardRoleRiskSummary = {
  privilegedUsers: number;
  suspendedPrivilegedUsers: number;
  recentRoleChanges: number;
  failedLoginSignals: number;
  unusualTenantAccessSignals: number;
  uniquePrivilegedActors: number;
  status: EnterpriseKpi["status"];
};

export type SuperAdminDashboardOperations = {
  dateRange: DashboardDateRange;
  thresholds: DashboardThresholds;
  finance: DashboardFinanceSummary;
  freshness: DashboardFreshnessSource[];
  slo: DashboardSloSummary;
  roleRisk: DashboardRoleRiskSummary;
  exportLinks: {
    csv: string;
    pdf: string;
  };
};

export type SuperAdminDashboardExportSummary = {
  organizations: number;
  gyms: number;
  branches: number;
  assignedPackages: number;
  unassignedPackages: number;
  finance: DashboardFinanceSummary;
  slo: DashboardSloSummary;
  roleRisk: DashboardRoleRiskSummary;
};

type PaymentRow = Pick<Database["public"]["Tables"]["payments"]["Row"], "id" | "invoice_id" | "status" | "amount" | "tax_amount" | "discount_amount" | "paid_at" | "collected_at" | "created_at" | "updated_at" | "provider" | "payment_type" | "method">;
type InvoiceRow = Pick<Database["public"]["Tables"]["invoices"]["Row"], "id" | "status" | "total_amount" | "amount_paid" | "amount_due" | "issued_at" | "paid_at" | "created_at" | "updated_at">;
type RefundRow = Pick<Database["public"]["Tables"]["refunds"]["Row"], "id" | "status" | "amount" | "processed_at" | "created_at" | "updated_at">;
type BillingEventRow = Pick<Database["public"]["Tables"]["billing_events"]["Row"], "id" | "event_type" | "status" | "created_at">;
type PaymentProviderEventRow = Pick<Database["public"]["Tables"]["payment_provider_events"]["Row"], "id" | "event_type" | "status" | "processed_at" | "created_at">;
type DashboardHealthCheckRow = Pick<Database["public"]["Tables"]["system_health_checks"]["Row"], "component" | "status" | "latency_ms" | "checked_at">;
type DashboardBackupJobRow = Pick<Database["public"]["Tables"]["backup_jobs"]["Row"], "status" | "created_at">;
type DashboardBranchUserRow = Pick<Database["public"]["Tables"]["branch_users"]["Row"], "role_name" | "status" | "updated_at">;
type DashboardActivityEventRow = Pick<Database["public"]["Tables"]["activity_events"]["Row"], "event_type" | "actor_id" | "created_at">;
type DashboardSecurityEventRow = Pick<Database["public"]["Tables"]["security_events"]["Row"], "event_type" | "status" | "actor_id" | "created_at">;

type DashboardSettingsRow = {
  key: string;
  value: Json;
};

type DashboardSettingsQuery = {
  select(columns: string): DashboardSettingsFilterQuery;
};

type DashboardSettingsFilterQuery = {
  eq(column: "key", value: string): DashboardSettingsSingleQuery;
};

type DashboardSettingsSingleQuery = {
  maybeSingle(): Promise<{ data: DashboardSettingsRow | null; error: { message: string } | null }>;
};

type DashboardSettingsClient = SupabaseClient<Database> & {
  from(table: "platform_dashboard_settings"): DashboardSettingsQuery;
};

type DashboardCountResult = Promise<{ data: null; error: { message: string } | null; count: number | null }>;

type DashboardCountQuery = {
  select(columns: "id", options: { count: "exact"; head: true }): DashboardCountResult;
};

type DashboardSupplementClient = {
  from(table: "organization_subscriptions"): DashboardCountQuery;
};

const DEFAULT_THRESHOLDS: DashboardThresholds = {
  readiness: {
    good: 85,
    watch: 70,
    criticalSecurityPenalty: 10,
    criticalSecurityCap: 30,
    downHealthPenalty: 14,
    downHealthCap: 28,
    degradedHealthPenalty: 5,
    degradedHealthCap: 15,
    failedBackupPenalty: 8,
    failedBackupCap: 20,
    failedDomainPenalty: 6,
    failedDomainCap: 18,
    hardBlockedSubscriptionPenalty: 5,
    hardBlockedSubscriptionCap: 20,
    unassignedSubscriptionPenalty: 3,
    unassignedSubscriptionCap: 15,
    overdueCompliancePenalty: 5,
    overdueComplianceCap: 15
  },
  usage: {
    watch: 70,
    risk: 90
  },
  freshness: {
    warningMinutes: 60,
    staleMinutes: 1440
  },
  slo: {
    uptimeTargetPercent: 99.9,
    apiP95MsTarget: 500,
    databaseP95MsTarget: 350,
    queueLagMsTarget: 60000,
    errorRateTargetPercent: 1,
    webhookFailureTarget: 0
  }
};

export function resolveDashboardDateRange(input: { range?: string; from?: string; to?: string } = {}): DashboardDateRange {
  const now = new Date();
  const key = dashboardDateRangeKeys.includes(input.range as DashboardDateRangeKey) ? input.range as DashboardDateRangeKey : "30d";
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  let from = addDays(todayStart, -29);
  let to = todayEnd;
  let label = "Last 30 days";

  if (key === "today") {
    from = todayStart;
    to = todayEnd;
    label = "Today";
  } else if (key === "7d") {
    from = addDays(todayStart, -6);
    label = "Last 7 days";
  } else if (key === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "This month";
  } else if (key === "quarter") {
    from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    label = "This quarter";
  } else if (key === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    label = "This year";
  } else if (key === "custom") {
    from = parseDateInput(input.from, addDays(todayStart, -29));
    to = endOfDay(parseDateInput(input.to, todayEnd));
    label = "Custom range";
  }

  if (from.getTime() > to.getTime()) {
    const previousFrom = from;
    from = startOfDay(to);
    to = endOfDay(previousFrom);
  }

  return {
    key,
    label,
    from,
    to,
    fromIso: from.toISOString(),
    toIso: to.toISOString()
  };
}

export async function getSuperAdminDashboardOperations(input: {
  dashboard: EnterpriseDashboard;
  orgSubscriptions: OrgSubscriptionSummary[];
  dateRange: DashboardDateRange;
}): Promise<SuperAdminDashboardOperations> {
  const supabase = await createSupabaseServerClient();
  const thresholds = await getDashboardThresholds(supabase);
  const finance = await getFinanceSummary(supabase, input.dateRange);
  const freshness = buildFreshnessSources(input.dashboard, input.orgSubscriptions, finance, thresholds);
  const slo = buildSloSummary(input.dashboard, finance, input.dateRange, thresholds);
  const roleRisk = buildRoleRiskSummary(input.dashboard, input.dateRange);
  const query = buildDateRangeQuery(input.dateRange);

  return {
    dateRange: input.dateRange,
    thresholds,
    finance,
    freshness,
    slo,
    roleRisk,
    exportLinks: {
      csv: `/api/super-admin/dashboard/export?format=csv&${query}`,
      pdf: `/api/super-admin/dashboard/export?format=pdf&${query}`
    }
  };
}

export async function getSuperAdminDashboardExportSummary(dateRange: DashboardDateRange): Promise<SuperAdminDashboardExportSummary> {
  const supabase = getSupabaseAdminClient() ?? await createSupabaseServerClient();
  const supplementClient = supabase as unknown as DashboardSupplementClient;
  const thresholds = await getDashboardThresholds(supabase);
  const [
    organizationsResult,
    gymsResult,
    branchesResult,
    subscriptionsResult,
    finance,
    healthChecksResult,
    backupJobsResult,
    branchUsersResult,
    activityEventsResult,
    securityEventsResult
  ] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("gyms").select("id", { count: "exact", head: true }),
    supabase.from("branches").select("id", { count: "exact", head: true }),
    supplementClient.from("organization_subscriptions").select("id", { count: "exact", head: true }),
    getFinanceSummary(supabase, dateRange),
    supabase
      .from("system_health_checks")
      .select("component, status, latency_ms, checked_at")
      .gte("checked_at", dateRange.fromIso)
      .lte("checked_at", dateRange.toIso)
      .order("checked_at", { ascending: false })
      .limit(1000),
    supabase
      .from("backup_jobs")
      .select("status, created_at")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("branch_users")
      .select("role_name, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("activity_events")
      .select("event_type, actor_id, created_at")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("security_events")
      .select("event_type, status, actor_id, created_at")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(1000)
  ]);

  const firstError = [
    organizationsResult,
    gymsResult,
    branchesResult,
    subscriptionsResult,
    healthChecksResult,
    backupJobsResult,
    branchUsersResult,
    activityEventsResult,
    securityEventsResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    console.error("[super-admin-dashboard] Export summary query failed.", firstError.message);
  }

  const organizations = organizationsResult.count ?? 0;
  const assignedPackages = subscriptionsResult.count ?? 0;

  return {
    organizations,
    gyms: gymsResult.count ?? 0,
    branches: branchesResult.count ?? 0,
    assignedPackages,
    unassignedPackages: Math.max(organizations - assignedPackages, 0),
    finance,
    slo: buildSloSummaryFromRows(
      (healthChecksResult.data ?? []) as DashboardHealthCheckRow[],
      (backupJobsResult.data ?? []) as DashboardBackupJobRow[],
      finance,
      thresholds
    ),
    roleRisk: buildRoleRiskSummaryFromRows(
      (branchUsersResult.data ?? []) as DashboardBranchUserRow[],
      (activityEventsResult.data ?? []) as DashboardActivityEventRow[],
      (securityEventsResult.data ?? []) as DashboardSecurityEventRow[]
    )
  };
}

async function getDashboardThresholds(supabase: SupabaseClient<Database>): Promise<DashboardThresholds> {
  const settingsClient = supabase as unknown as DashboardSettingsClient;
  const { data, error } = await settingsClient
    .from("platform_dashboard_settings")
    .select("key, value")
    .eq("key", "super_admin_dashboard_thresholds")
    .maybeSingle();

  if (error) {
    console.error("[super-admin-dashboard] Could not load dashboard thresholds.", error.message);
    return DEFAULT_THRESHOLDS;
  }

  return mergeThresholds(data?.value);
}

async function getFinanceSummary(supabase: SupabaseClient<Database>, dateRange: DashboardDateRange): Promise<DashboardFinanceSummary> {
  const [
    paymentsResult,
    invoicesResult,
    refundsResult,
    billingEventsResult,
    providerEventsResult
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("id, invoice_id, status, amount, tax_amount, discount_amount, paid_at, collected_at, created_at, updated_at, provider, payment_type, method")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("invoices")
      .select("id, status, total_amount, amount_paid, amount_due, issued_at, paid_at, created_at, updated_at")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("refunds")
      .select("id, status, amount, processed_at, created_at, updated_at")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("billing_events")
      .select("id, event_type, status, created_at")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("payment_provider_events")
      .select("id, event_type, status, processed_at, created_at")
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso)
      .order("created_at", { ascending: false })
      .limit(5000)
  ]);

  const firstError = [paymentsResult, invoicesResult, refundsResult, billingEventsResult, providerEventsResult].find((result) => result.error)?.error;

  if (firstError) {
    console.error("[super-admin-dashboard] Finance summary query failed.", firstError.message);
  }

  const payments = ((paymentsResult.data ?? []) as PaymentRow[]).filter((payment) => isDateInRange(payment.paid_at ?? payment.collected_at ?? payment.created_at, dateRange));
  const invoices = ((invoicesResult.data ?? []) as InvoiceRow[]).filter((invoice) => isDateInRange(invoice.issued_at ?? invoice.created_at, dateRange));
  const refunds = ((refundsResult.data ?? []) as RefundRow[]).filter((refund) => isDateInRange(refund.processed_at ?? refund.created_at, dateRange));
  const billingEvents = ((billingEventsResult.data ?? []) as BillingEventRow[]).filter((event) => isDateInRange(event.created_at, dateRange));
  const providerEvents = ((providerEventsResult.data ?? []) as PaymentProviderEventRow[]).filter((event) => isDateInRange(event.created_at, dateRange));
  const paidPayments = payments.filter((payment) => payment.status === "paid" || payment.status === "partially_refunded");
  const failedPayments = payments.filter((payment) => payment.status === "failed" || payment.status === "cancelled");
  const processedRefunds = refunds.filter((refund) => refund.status === "processed");
  const failedProviderEvents = providerEvents.filter((event) => event.status === "failed");
  const failedBillingWebhooks = billingEvents.filter((event) => event.event_type === "webhook_received" && event.status === "failed");
  const paymentsByInvoice = new Map<string, number>();

  for (const payment of paidPayments) {
    if (payment.invoice_id) {
      paymentsByInvoice.set(payment.invoice_id, (paymentsByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount ?? 0));
    }
  }

  const reconciliationIssues = invoices.filter((invoice) => {
    if (invoice.status !== "paid" && invoice.status !== "partially_paid") {
      return false;
    }

    const paidAmount = paymentsByInvoice.get(invoice.id) ?? Number(invoice.amount_paid ?? 0);
    return Math.abs(paidAmount - Number(invoice.amount_paid ?? 0)) > 1;
  }).length;

  const grossRevenue = sum(paidPayments.map((payment) => Number(payment.amount ?? 0)));
  const refundAmount = sum(processedRefunds.map((refund) => Number(refund.amount ?? 0)));

  return {
    grossRevenue,
    netRevenue: grossRevenue - refundAmount,
    refundAmount,
    taxCollected: sum(paidPayments.map((payment) => Number(payment.tax_amount ?? 0))),
    discounts: sum(paidPayments.map((payment) => Number(payment.discount_amount ?? 0))),
    outstandingAmount: sum(invoices.filter((invoice) => invoice.status === "issued" || invoice.status === "partially_paid").map((invoice) => Number(invoice.amount_due ?? 0))),
    paidPayments: paidPayments.length,
    failedPayments: failedPayments.length,
    invoicesIssued: invoices.length,
    invoicesPaid: invoices.filter((invoice) => invoice.status === "paid").length,
    refundsProcessed: processedRefunds.length,
    reconciliationIssues,
    webhookFailures: failedProviderEvents.length + failedBillingWebhooks.length,
    lastLedgerAt: latest([
      ...payments.map((row) => row.updated_at ?? row.created_at),
      ...invoices.map((row) => row.updated_at ?? row.created_at),
      ...refunds.map((row) => row.updated_at ?? row.created_at),
      ...providerEvents.map((row) => row.processed_at ?? row.created_at),
      ...billingEvents.map((row) => row.created_at)
    ]),
    sourceLabel: "payments, invoices, refunds, provider events"
  };
}

function buildFreshnessSources(
  dashboard: EnterpriseDashboard,
  orgSubscriptions: OrgSubscriptionSummary[],
  finance: DashboardFinanceSummary,
  thresholds: DashboardThresholds
): DashboardFreshnessSource[] {
  return [
    freshness("Tenant Records", "organizations", latest(dashboard.organizations.map((row) => row.updated_at ?? row.created_at)), thresholds),
    freshness("Package Assignments", "organization_subscriptions", latest(orgSubscriptions.map((row) => row.startedAt ?? row.expiresAt ?? row.trialEndsAt)), thresholds),
    freshness("Finance Ledger", "payments/invoices/refunds", finance.lastLedgerAt, thresholds),
    freshness("Security Events", "security_events", latest(dashboard.securityEvents.map((row) => row.created_at)), thresholds),
    freshness("Health Checks", "system_health_checks", latest(dashboard.healthChecks.map((row) => row.checked_at)), thresholds),
    freshness("Backups", "backup_jobs", latest(dashboard.backupJobs.map((row) => row.created_at)), thresholds)
  ];
}

function buildSloSummary(
  dashboard: EnterpriseDashboard,
  finance: DashboardFinanceSummary,
  dateRange: DashboardDateRange,
  thresholds: DashboardThresholds
): DashboardSloSummary {
  const checks = dashboard.healthChecks.filter((check) => isDateInRange(check.checked_at, dateRange));
  const totalChecks = checks.length;
  const unhealthyChecks = checks.filter((check) => check.status === "down" || check.status === "degraded" || check.status === "unknown").length;
  const uptimePercent = totalChecks > 0 ? roundTo((1 - unhealthyChecks / totalChecks) * 100, 2) : 100;
  const errorRatePercent = totalChecks > 0 ? roundTo((unhealthyChecks / totalChecks) * 100, 2) : 0;
  const apiP95Ms = percentile(checks.filter((check) => check.component === "api").map((check) => check.latency_ms).filter(isNumber), 95);
  const databaseP95Ms = percentile(checks.filter((check) => check.component === "database").map((check) => check.latency_ms).filter(isNumber), 95);
  const queueLagMs = percentile(checks.filter((check) => check.component === "queue" || check.component === "background_jobs").map((check) => check.latency_ms).filter(isNumber), 95);
  const failedJobs = dashboard.backupJobs.filter((job) => job.status === "failed" && isDateInRange(job.created_at, dateRange)).length;
  const status = uptimePercent < thresholds.slo.uptimeTargetPercent
    || errorRatePercent > thresholds.slo.errorRateTargetPercent
    || (apiP95Ms !== null && apiP95Ms > thresholds.slo.apiP95MsTarget)
    || (databaseP95Ms !== null && databaseP95Ms > thresholds.slo.databaseP95MsTarget)
    || (queueLagMs !== null && queueLagMs > thresholds.slo.queueLagMsTarget)
    || failedJobs > 0
    || finance.webhookFailures > thresholds.slo.webhookFailureTarget
      ? "risk"
      : "good";

  return {
    uptimePercent,
    errorRatePercent,
    apiP95Ms,
    databaseP95Ms,
    queueLagMs,
    failedJobs,
    webhookFailures: finance.webhookFailures,
    status
  };
}

function buildRoleRiskSummary(dashboard: EnterpriseDashboard, dateRange: DashboardDateRange): DashboardRoleRiskSummary {
  const privilegedRoles = new Set(["super_admin", "organization_owner", "gym_admin"]);
  const privilegedUsers = dashboard.branchUsers.filter((user) => privilegedRoles.has(user.role_name));
  const recentActivity = dashboard.activityEvents.filter((event) => isDateInRange(event.created_at, dateRange));
  const securityEvents = dashboard.securityEvents.filter((event) => isDateInRange(event.created_at, dateRange));
  const recentRoleChanges = recentActivity.filter((event) => /role|permission|privilege|user/.test(event.event_type.toLowerCase())).length;
  const failedLoginSignals = securityEvents.filter((event) => /login|auth|mfa|session|password/.test(event.event_type.toLowerCase()) && event.status !== "resolved").length;
  const unusualTenantAccessSignals = securityEvents.filter((event) => /tenant|access|idor|scope|organization|branch/.test(event.event_type.toLowerCase()) && event.status !== "resolved").length;
  const uniquePrivilegedActors = new Set(recentActivity.map((event) => event.actor_id).filter(Boolean)).size;
  const suspendedPrivilegedUsers = privilegedUsers.filter((user) => user.status === "suspended" || user.status === "revoked").length;
  const status = suspendedPrivilegedUsers > 0 || failedLoginSignals > 0 || unusualTenantAccessSignals > 0
    ? "risk"
    : recentRoleChanges > 0
      ? "watch"
      : "good";

  return {
    privilegedUsers: privilegedUsers.length,
    suspendedPrivilegedUsers,
    recentRoleChanges,
    failedLoginSignals,
    unusualTenantAccessSignals,
    uniquePrivilegedActors,
    status
  };
}

function buildSloSummaryFromRows(
  healthChecks: DashboardHealthCheckRow[],
  backupJobs: DashboardBackupJobRow[],
  finance: DashboardFinanceSummary,
  thresholds: DashboardThresholds
): DashboardSloSummary {
  const totalChecks = healthChecks.length;
  const unhealthyChecks = healthChecks.filter((check) => check.status === "down" || check.status === "degraded" || check.status === "unknown").length;
  const uptimePercent = totalChecks > 0 ? roundTo((1 - unhealthyChecks / totalChecks) * 100, 2) : 100;
  const errorRatePercent = totalChecks > 0 ? roundTo((unhealthyChecks / totalChecks) * 100, 2) : 0;
  const apiP95Ms = percentile(healthChecks.filter((check) => check.component === "api").map((check) => check.latency_ms).filter(isNumber), 95);
  const databaseP95Ms = percentile(healthChecks.filter((check) => check.component === "database").map((check) => check.latency_ms).filter(isNumber), 95);
  const queueLagMs = percentile(healthChecks.filter((check) => check.component === "queue" || check.component === "background_jobs").map((check) => check.latency_ms).filter(isNumber), 95);
  const failedJobs = backupJobs.filter((job) => job.status === "failed").length;
  const status = uptimePercent < thresholds.slo.uptimeTargetPercent
    || errorRatePercent > thresholds.slo.errorRateTargetPercent
    || (apiP95Ms !== null && apiP95Ms > thresholds.slo.apiP95MsTarget)
    || (databaseP95Ms !== null && databaseP95Ms > thresholds.slo.databaseP95MsTarget)
    || (queueLagMs !== null && queueLagMs > thresholds.slo.queueLagMsTarget)
    || failedJobs > 0
    || finance.webhookFailures > thresholds.slo.webhookFailureTarget
      ? "risk"
      : "good";

  return {
    uptimePercent,
    errorRatePercent,
    apiP95Ms,
    databaseP95Ms,
    queueLagMs,
    failedJobs,
    webhookFailures: finance.webhookFailures,
    status
  };
}

function buildRoleRiskSummaryFromRows(
  branchUsers: DashboardBranchUserRow[],
  activityEvents: DashboardActivityEventRow[],
  securityEvents: DashboardSecurityEventRow[]
): DashboardRoleRiskSummary {
  const privilegedRoles = new Set(["super_admin", "organization_owner", "gym_admin"]);
  const privilegedUsers = branchUsers.filter((user) => privilegedRoles.has(user.role_name));
  const recentRoleChanges = activityEvents.filter((event) => /role|permission|privilege|user/.test(event.event_type.toLowerCase())).length;
  const failedLoginSignals = securityEvents.filter((event) => /login|auth|mfa|session|password/.test(event.event_type.toLowerCase()) && event.status !== "resolved").length;
  const unusualTenantAccessSignals = securityEvents.filter((event) => /tenant|access|idor|scope|organization|branch/.test(event.event_type.toLowerCase()) && event.status !== "resolved").length;
  const uniquePrivilegedActors = new Set(activityEvents.map((event) => event.actor_id).filter(Boolean)).size;
  const suspendedPrivilegedUsers = privilegedUsers.filter((user) => user.status === "suspended" || user.status === "revoked").length;
  const status = suspendedPrivilegedUsers > 0 || failedLoginSignals > 0 || unusualTenantAccessSignals > 0
    ? "risk"
    : recentRoleChanges > 0
      ? "watch"
      : "good";

  return {
    privilegedUsers: privilegedUsers.length,
    suspendedPrivilegedUsers,
    recentRoleChanges,
    failedLoginSignals,
    unusualTenantAccessSignals,
    uniquePrivilegedActors,
    status
  };
}

function mergeThresholds(value: Json | null | undefined): DashboardThresholds {
  if (!isRecord(value)) {
    return DEFAULT_THRESHOLDS;
  }

  return {
    readiness: {
      ...DEFAULT_THRESHOLDS.readiness,
      ...numberRecord(value.readiness)
    },
    usage: {
      ...DEFAULT_THRESHOLDS.usage,
      ...numberRecord(value.usage)
    },
    freshness: {
      ...DEFAULT_THRESHOLDS.freshness,
      ...numberRecord(value.freshness)
    },
    slo: {
      ...DEFAULT_THRESHOLDS.slo,
      ...numberRecord(value.slo)
    }
  };
}

function freshness(label: string, source: string, lastUpdatedAt: string | null, thresholds: DashboardThresholds): DashboardFreshnessSource {
  const ageMinutes = lastUpdatedAt ? Math.max(0, Math.round((Date.now() - new Date(lastUpdatedAt).getTime()) / 60000)) : null;
  const status = ageMinutes === null
    ? "watch"
    : ageMinutes >= thresholds.freshness.staleMinutes
      ? "risk"
      : ageMinutes >= thresholds.freshness.warningMinutes
        ? "watch"
        : "good";

  return {
    label,
    source,
    lastUpdatedAt,
    ageMinutes,
    status
  };
}

function buildDateRangeQuery(dateRange: DashboardDateRange) {
  const params = new URLSearchParams({ range: dateRange.key });
  if (dateRange.key === "custom") {
    params.set("from", toDateInput(dateRange.from));
    params.set("to", toDateInput(dateRange.to));
  }
  return params.toString();
}

function isDateInRange(value: string | null | undefined, range: DashboardDateRange) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time >= range.from.getTime() && time <= range.to.getTime();
}

function parseDateInput(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function latest(values: Array<string | null | undefined>) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => !Number.isNaN(value));

  if (times.length === 0) {
    return null;
  }

  return new Date(Math.max(...times)).toISOString();
}

function percentile(values: number[], percent: number) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[index] ?? null;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberRecord(value: Json | undefined) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number")
  );
}
