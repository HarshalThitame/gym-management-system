import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/types/auth";
import type { Database } from "@/types/database";
import type {
  ActivityEventRow,
  BranchMetricRow,
  BranchRow,
  BranchSettingRow,
  BranchUserRow,
  ComplianceRequestRow,
  FeatureFlagRow,
  GymRow,
  OrganizationRow,
  PlatformSubscriptionRow,
  SecurityEventRow,
  SystemHealthCheckRow,
  TenantConfigRow,
  TenantDomainCheckRow,
  TenantDomainProviderEventRow,
  TenantDomainRow
} from "@/types/enterprise";

type MemberRow = Database["public"]["Tables"]["members"]["Row"];
type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];
type AttendanceLogRow = Database["public"]["Tables"]["attendance_logs"]["Row"];
type ClassSessionRow = Database["public"]["Tables"]["class_sessions"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];

export type OrganizationOwnerDashboard = {
  organization: OrganizationRow;
  gyms: GymRow[];
  branches: BranchRow[];
  branchSettings: BranchSettingRow[];
  branchUsers: BranchUserRow[];
  branchMetrics: BranchMetricRow[];
  tenantConfigs: TenantConfigRow[];
  tenantDomains: TenantDomainRow[];
  tenantDomainChecks: TenantDomainCheckRow[];
  tenantDomainProviderEvents: TenantDomainProviderEventRow[];
  featureFlags: FeatureFlagRow[];
  subscriptions: PlatformSubscriptionRow[];
  activityEvents: ActivityEventRow[];
  securityEvents: SecurityEventRow[];
  complianceRequests: ComplianceRequestRow[];
  healthChecks: SystemHealthCheckRow[];
  members: MemberRow[];
  membershipPlans: MembershipPlanRow[];
  memberships: MembershipRow[];
  payments: PaymentRow[];
  trainers: TrainerRow[];
  attendanceLogs: AttendanceLogRow[];
  classSessions: ClassSessionRow[];
  notifications: NotificationRow[];
  campaigns: CampaignRow[];
  gymIds: string[];
  branchIds: string[];
  metrics: {
    totalRevenue: number;
    activeMembers: number;
    totalAttendance: number;
    avgTrainerUtilization: number;
    avgClassUtilization: number;
    storageMb: number;
    paidPayments: number;
    failedPayments: number;
    activeSubscriptions: number;
    openSecurityEvents: number;
  };
};

export type ScopedOrganizationOwnerContext = AuthContext & {
  organizationId: string;
};

export async function getOrganizationOwnerDashboard(context: ScopedOrganizationOwnerContext): Promise<OrganizationOwnerDashboard> {
  const supabase = await createSupabaseServerClient();
  const organizationId = context.organizationId;

  const [
    organizationResult,
    gymsResult,
    branchesResult,
    branchSettingsResult,
    branchUsersResult,
    branchMetricsResult,
    tenantConfigsResult,
    tenantDomainsResult,
    tenantDomainChecksResult,
    tenantDomainProviderEventsResult,
    featureFlagsResult,
    subscriptionsResult,
    activityEventsResult,
    securityEventsResult,
    complianceRequestsResult,
    healthChecksResult
  ] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
    supabase.from("gyms").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("branches").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
    supabase.from("branch_settings").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(200),
    supabase.from("branch_users").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(500),
    supabase.from("branch_metrics").select("*").eq("organization_id", organizationId).order("metric_date", { ascending: false }).limit(1000),
    supabase.from("tenant_configs").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(50),
    supabase.from("tenant_domains").select("*").eq("organization_id", organizationId).order("is_primary", { ascending: false }).order("updated_at", { ascending: false }).limit(100),
    supabase.from("tenant_domain_checks").select("*").eq("organization_id", organizationId).order("checked_at", { ascending: false }).limit(100),
    supabase.from("tenant_domain_provider_events").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("feature_flags").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(100),
    supabase.from("platform_subscriptions").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(20),
    supabase.from("activity_events").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("security_events").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("compliance_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("system_health_checks").select("*").eq("organization_id", organizationId).order("checked_at", { ascending: false }).limit(100)
  ]);

  const firstOrganizationError = [
    organizationResult,
    gymsResult,
    branchesResult,
    branchSettingsResult,
    branchUsersResult,
    branchMetricsResult,
    tenantConfigsResult,
    tenantDomainsResult,
    tenantDomainChecksResult,
    tenantDomainProviderEventsResult,
    featureFlagsResult,
    subscriptionsResult,
    activityEventsResult,
    securityEventsResult,
    complianceRequestsResult,
    healthChecksResult
  ].find((result) => result.error)?.error;

  if (firstOrganizationError) {
    throw new Error(firstOrganizationError.message);
  }

  if (!organizationResult.data) {
    throw new Error("Organization scope was not found.");
  }

  const gyms = gymsResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const gymIds = unique([...gyms.map((gym) => gym.id), ...branches.map((branch) => branch.gym_id).filter(isString)]);
  const branchIds = branches.map((branch) => branch.id);
  const gymScoped = await loadGymScopedData(supabase, gymIds);
  const branchMetrics = branchMetricsResult.data ?? [];
  const payments = gymScoped.payments;
  const subscriptions = subscriptionsResult.data ?? [];
  const trainerUtilizationValues = branchMetrics.map((metric) => Number(metric.trainer_utilization ?? 0));
  const classUtilizationValues = branchMetrics.map((metric) => Number(metric.class_utilization ?? 0));

  return {
    organization: organizationResult.data,
    gyms,
    branches,
    branchSettings: branchSettingsResult.data ?? [],
    branchUsers: branchUsersResult.data ?? [],
    branchMetrics,
    tenantConfigs: tenantConfigsResult.data ?? [],
    tenantDomains: tenantDomainsResult.data ?? [],
    tenantDomainChecks: tenantDomainChecksResult.data ?? [],
    tenantDomainProviderEvents: tenantDomainProviderEventsResult.data ?? [],
    featureFlags: featureFlagsResult.data ?? [],
    subscriptions,
    activityEvents: activityEventsResult.data ?? [],
    securityEvents: securityEventsResult.data ?? [],
    complianceRequests: complianceRequestsResult.data ?? [],
    healthChecks: healthChecksResult.data ?? [],
    ...gymScoped,
    gymIds,
    branchIds,
    metrics: {
      totalRevenue: sum(branchMetrics.map((metric) => Number(metric.revenue_amount ?? 0))),
      activeMembers: Math.max(sum(branchMetrics.map((metric) => Number(metric.active_members ?? 0))), gymScoped.members.filter((member) => member.status === "active").length),
      totalAttendance: sum(branchMetrics.map((metric) => Number(metric.attendance_count ?? 0))),
      avgTrainerUtilization: average(trainerUtilizationValues),
      avgClassUtilization: average(classUtilizationValues),
      storageMb: sum(branchMetrics.map((metric) => Number(metric.storage_mb ?? 0))),
      paidPayments: payments.filter((payment) => payment.status === "paid").length,
      failedPayments: payments.filter((payment) => payment.status === "failed").length,
      activeSubscriptions: subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trial").length,
      openSecurityEvents: (securityEventsResult.data ?? []).filter((event) => event.status === "open" || event.status === "investigating").length
    }
  };
}

async function loadGymScopedData(supabase: SupabaseClient<Database>, gymIds: string[]) {
  if (gymIds.length === 0) {
    return {
      members: [] as MemberRow[],
      membershipPlans: [] as MembershipPlanRow[],
      memberships: [] as MembershipRow[],
      payments: [] as PaymentRow[],
      trainers: [] as TrainerRow[],
      attendanceLogs: [] as AttendanceLogRow[],
      classSessions: [] as ClassSessionRow[],
      notifications: [] as NotificationRow[],
      campaigns: [] as CampaignRow[]
    };
  }

  const [
    membersResult,
    membershipPlansResult,
    membershipsResult,
    paymentsResult,
    trainersResult,
    attendanceLogsResult,
    classSessionsResult,
    notificationsResult,
    campaignsResult
  ] = await Promise.all([
    supabase.from("members").select("*").in("gym_id", gymIds).order("created_at", { ascending: false }).limit(300),
    supabase.from("membership_plans").select("*").in("gym_id", gymIds).order("display_order", { ascending: true }).limit(200),
    supabase.from("memberships").select("*").in("gym_id", gymIds).order("created_at", { ascending: false }).limit(300),
    supabase.from("payments").select("*").in("gym_id", gymIds).order("created_at", { ascending: false }).limit(300),
    supabase.from("trainers").select("*").in("gym_id", gymIds).order("created_at", { ascending: false }).limit(200),
    supabase.from("attendance_logs").select("*").in("gym_id", gymIds).order("occurred_at", { ascending: false }).limit(300),
    supabase.from("class_sessions").select("*").in("gym_id", gymIds).order("starts_at", { ascending: false }).limit(300),
    supabase.from("notifications").select("*").in("gym_id", gymIds).order("created_at", { ascending: false }).limit(200),
    supabase.from("campaigns").select("*").in("gym_id", gymIds).order("created_at", { ascending: false }).limit(100)
  ]);

  const firstError = [
    membersResult,
    membershipPlansResult,
    membershipsResult,
    paymentsResult,
    trainersResult,
    attendanceLogsResult,
    classSessionsResult,
    notificationsResult,
    campaignsResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    members: membersResult.data ?? [],
    membershipPlans: membershipPlansResult.data ?? [],
    memberships: membershipsResult.data ?? [],
    payments: paymentsResult.data ?? [],
    trainers: trainersResult.data ?? [],
    attendanceLogs: attendanceLogsResult.data ?? [],
    classSessions: classSessionsResult.data ?? [],
    notifications: notificationsResult.data ?? [],
    campaigns: campaignsResult.data ?? []
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function isString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((sum(values) / values.length) * 100) / 100;
}
