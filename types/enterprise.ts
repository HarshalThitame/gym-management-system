import type { Database, Json } from "./database";

export const organizationTypes = ["single_gym", "multi_branch", "franchise"] as const;
export const organizationStatuses = ["active", "trial", "suspended", "deactivated", "archived"] as const;
export const branchStatuses = ["planned", "active", "maintenance", "suspended", "deactivated", "archived"] as const;
export const branchRoles = ["owner", "admin", "manager", "staff", "trainer", "viewer"] as const;
export const branchAccessScopes = ["single_branch", "multi_branch", "organization"] as const;
export const planTiers = ["starter", "professional", "enterprise"] as const;
export const featureFlagStatuses = ["active", "paused", "archived"] as const;
export const subscriptionStatuses = ["trial", "active", "past_due", "cancelled", "suspended"] as const;
export const complianceRequestTypes = ["data_export", "data_deletion", "consent_review", "privacy_update"] as const;
export const complianceStatuses = ["open", "in_review", "approved", "completed", "rejected"] as const;
export const retentionCategories = ["attendance", "payments", "communications", "audit_logs", "fitness", "documents"] as const;
export const retentionActions = ["archive", "anonymize", "delete", "legal_hold"] as const;
export const backupTypes = ["database", "files", "configuration", "full"] as const;
export const backupScopes = ["platform", "tenant", "branch"] as const;
export const backupStatuses = ["queued", "running", "completed", "failed", "cancelled"] as const;
export const healthComponents = ["api", "database", "storage", "queue", "email", "payments", "auth", "background_jobs"] as const;
export const healthStatuses = ["healthy", "degraded", "down", "unknown"] as const;
export const securitySeverities = ["low", "medium", "high", "critical"] as const;
export const securityStatuses = ["open", "investigating", "resolved", "dismissed"] as const;
export const documentationAudiences = ["admin", "trainer", "member", "api", "deployment"] as const;

export type OrganizationType = (typeof organizationTypes)[number];
export type OrganizationStatus = (typeof organizationStatuses)[number];
export type BranchStatus = (typeof branchStatuses)[number];
export type BranchRole = (typeof branchRoles)[number];
export type PlanTier = (typeof planTiers)[number];
export type FeatureFlagStatus = (typeof featureFlagStatuses)[number];
export type ComplianceRequestType = (typeof complianceRequestTypes)[number];
export type RetentionCategory = (typeof retentionCategories)[number];
export type BackupType = (typeof backupTypes)[number];
export type HealthStatus = (typeof healthStatuses)[number];

export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
export type BranchSettingRow = Database["public"]["Tables"]["branch_settings"]["Row"];
export type BranchUserRow = Database["public"]["Tables"]["branch_users"]["Row"];
export type BranchMetricRow = Database["public"]["Tables"]["branch_metrics"]["Row"];
export type TenantConfigRow = Database["public"]["Tables"]["tenant_configs"]["Row"];
export type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
export type PlatformSubscriptionRow = Database["public"]["Tables"]["platform_subscriptions"]["Row"];
export type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
export type SecurityEventRow = Database["public"]["Tables"]["security_events"]["Row"];
export type ComplianceRequestRow = Database["public"]["Tables"]["compliance_requests"]["Row"];
export type RetentionPolicyRow = Database["public"]["Tables"]["retention_policies"]["Row"];
export type BackupJobRow = Database["public"]["Tables"]["backup_jobs"]["Row"];
export type SystemHealthCheckRow = Database["public"]["Tables"]["system_health_checks"]["Row"];
export type DocumentationArticleRow = Database["public"]["Tables"]["documentation_articles"]["Row"];
export type EnterpriseBranchMetricsLatestRow = Database["public"]["Views"]["enterprise_branch_metrics_latest"]["Row"];
export type EnterpriseTenantUsageSummaryRow = Database["public"]["Views"]["enterprise_tenant_usage_summary"]["Row"];
export type EnterpriseSecuritySummaryRow = Database["public"]["Views"]["enterprise_security_summary"]["Row"];

export type EnterpriseKpi = {
  key: string;
  label: string;
  value: string;
  detail: string;
  status: "good" | "watch" | "risk";
};

export type BranchPerformancePoint = {
  branchName: string;
  revenue: number;
  members: number;
  attendance: number;
  trainerUtilization: number;
  classUtilization: number;
};

export type TenantUsagePoint = {
  organizationName: string;
  branches: number;
  activeMembers: number;
  storagePercent: number;
  branchPercent: number;
  memberPercent: number;
};

export type EnterpriseDashboard = {
  kpis: EnterpriseKpi[];
  organizations: OrganizationRow[];
  branches: BranchRow[];
  branchSettings: BranchSettingRow[];
  branchUsers: BranchUserRow[];
  branchMetrics: BranchMetricRow[];
  tenantConfigs: TenantConfigRow[];
  featureFlags: FeatureFlagRow[];
  subscriptions: PlatformSubscriptionRow[];
  activityEvents: ActivityEventRow[];
  securityEvents: SecurityEventRow[];
  complianceRequests: ComplianceRequestRow[];
  retentionPolicies: RetentionPolicyRow[];
  backupJobs: BackupJobRow[];
  healthChecks: SystemHealthCheckRow[];
  documentationArticles: DocumentationArticleRow[];
  branchLatestMetrics: EnterpriseBranchMetricsLatestRow[];
  tenantUsage: EnterpriseTenantUsageSummaryRow[];
  securitySummary: EnterpriseSecuritySummaryRow[];
  branchPerformance: BranchPerformancePoint[];
  tenantUsagePoints: TenantUsagePoint[];
};

export type JsonRecord = Record<string, Json>;
