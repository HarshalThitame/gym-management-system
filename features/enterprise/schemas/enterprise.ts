import { z } from "zod";
import {
  backupScopes,
  backupTypes,
  branchAccessScopes,
  branchRoles,
  branchStatuses,
  complianceRequestTypes,
  complianceStatuses,
  featureFlagStatuses,
  gymStatuses,
  healthComponents,
  healthStatuses,
  organizationStatuses,
  organizationTypes,
  planTiers,
  retentionActions,
  retentionCategories,
  securityStatuses,
  tenantDomainRoutingModes,
  tenantDomainTypes
} from "@/types/enterprise";
import { roleNames } from "@/types/auth";

const optionalUuid = z.string().uuid().or(z.literal("")).optional();
const optionalUrl = z.string().url().or(z.literal("")).optional();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color.");

export const OrganizationSchema = z.object({
  organizationId: optionalUuid,
  name: z.string().min(2).max(140),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  organizationType: z.enum(organizationTypes),
  status: z.enum(organizationStatuses),
  primaryDomain: z.string().max(160).optional(),
  billingEmail: z.string().email().or(z.literal("")).optional(),
  settings: z.string().optional()
});

export const GymSchema = z.object({
  gymId: optionalUuid,
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(140),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timezone: z.string().min(2).max(80),
  currency: z.string().length(3),
  status: z.enum(gymStatuses)
});

export const BranchSchema = z.object({
  branchId: optionalUuid,
  organizationId: z.string().uuid(),
  gymId: optionalUuid,
  name: z.string().min(2).max(140),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  branchCode: z.string().min(2).max(32),
  status: z.enum(branchStatuses),
  timezone: z.string().min(2).max(80),
  currency: z.string().length(3),
  address: z.string().max(240).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  country: z.string().min(2).max(80),
  postalCode: z.string().max(24).optional(),
  phone: z.string().max(24).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  capacity: z.coerce.number().int().min(0),
  operatingHours: z.string().optional()
});

export const BranchUserSchema = z.object({
  branchUserId: optionalUuid,
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  userId: z.string().uuid(),
  roleName: z.enum(roleNames),
  branchRole: z.enum(branchRoles),
  accessScope: z.enum(branchAccessScopes),
  status: z.enum(["active", "invited", "suspended", "revoked"]),
  permissions: z.string().optional()
});

export const BranchSettingsSchema = z.object({
  branchSettingsId: optionalUuid,
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  generalSettings: z.string().optional(),
  membershipSettings: z.string().optional(),
  paymentSettings: z.string().optional(),
  attendanceSettings: z.string().optional(),
  classSettings: z.string().optional(),
  notificationSettings: z.string().optional(),
  securitySettings: z.string().optional()
});

export const TenantConfigSchema = z.object({
  tenantConfigId: optionalUuid,
  organizationId: z.string().uuid(),
  tenantKey: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  planTier: z.enum(planTiers),
  status: z.enum(["active", "trial", "suspended", "archived"]),
  customDomain: z.string().max(160).optional(),
  subdomain: z.string().max(80).optional(),
  brandName: z.string().min(2).max(140),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  primaryColor: color,
  secondaryColor: color,
  accentColor: color,
  typography: z.string().optional(),
  emailBranding: z.string().optional(),
  limits: z.string().optional(),
  complianceSettings: z.string().optional()
});

export const TenantDomainSchema = z.object({
  tenantDomainId: optionalUuid,
  organizationId: z.string().uuid(),
  branchId: optionalUuid,
  gymId: optionalUuid,
  tenantConfigId: optionalUuid,
  domain: z.string().trim().min(3).max(253),
  domainType: z.enum(tenantDomainTypes).refine((value) => value !== "system", "System domains are managed by deployment configuration."),
  routingMode: z.enum(tenantDomainRoutingModes),
  status: z.enum(["pending", "disabled"]),
  isPrimary: z.boolean()
}).superRefine((value, context) => {
  if (value.routingMode === "branch" && !value.branchId) {
    context.addIssue({ code: "custom", message: "Select a branch for branch routing.", path: ["branchId"] });
  }

  if (value.routingMode === "gym" && !value.gymId) {
    context.addIssue({ code: "custom", message: "Enter a gym ID for gym routing.", path: ["gymId"] });
  }
});

export const TenantDomainLifecycleSchema = z.object({
  tenantDomainId: z.string().uuid(),
  action: z.enum(["set_primary", "disable", "restore"])
});

export const FeatureFlagSchema = z.object({
  featureFlagId: optionalUuid,
  organizationId: optionalUuid,
  branchId: optionalUuid,
  flagKey: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  name: z.string().min(2).max(140),
  description: z.string().max(360).optional(),
  enabled: z.boolean(),
  rolloutPercentage: z.coerce.number().int().min(0).max(100),
  targetPlanTiers: z.string().optional(),
  rules: z.string().optional(),
  status: z.enum(featureFlagStatuses)
});

export const SubscriptionSchema = z.object({
  subscriptionId: optionalUuid,
  organizationId: z.string().uuid(),
  planTier: z.enum(planTiers),
  status: z.enum(["trial", "active", "past_due", "cancelled", "suspended"]),
  branchLimit: z.coerce.number().int().min(1),
  memberLimit: z.coerce.number().int().min(0),
  staffLimit: z.coerce.number().int().min(0),
  storageLimitMb: z.coerce.number().int().min(0),
  renewsOn: z.string().optional(),
  trialEndsOn: z.string().optional()
});

export const RetentionPolicySchema = z.object({
  retentionPolicyId: optionalUuid,
  organizationId: optionalUuid,
  branchId: optionalUuid,
  dataCategory: z.enum(retentionCategories),
  retentionDays: z.coerce.number().int().min(30).max(3650),
  dispositionAction: z.enum(retentionActions),
  legalHold: z.boolean(),
  status: z.enum(["active", "paused", "archived"])
});

export const ComplianceRequestSchema = z.object({
  complianceRequestId: optionalUuid,
  organizationId: optionalUuid,
  branchId: optionalUuid,
  requestType: z.enum(complianceRequestTypes),
  requesterEmail: z.string().email(),
  status: z.enum(complianceStatuses),
  dueAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.string().optional()
});

export const BackupJobSchema = z.object({
  organizationId: optionalUuid,
  branchId: optionalUuid,
  backupType: z.enum(backupTypes),
  scope: z.enum(backupScopes),
  metadata: z.string().optional()
});

export const HealthCheckSchema = z.object({
  organizationId: optionalUuid,
  branchId: optionalUuid,
  checkKey: z.string().min(2).max(80),
  component: z.enum(healthComponents),
  status: z.enum(healthStatuses),
  latencyMs: z.coerce.number().int().min(0).optional(),
  message: z.string().max(360).optional(),
  metadata: z.string().optional()
});

export const SecurityEventStatusSchema = z.object({
  securityEventId: z.string().uuid(),
  status: z.enum(securityStatuses)
});

export type OrganizationInput = z.infer<typeof OrganizationSchema>;
