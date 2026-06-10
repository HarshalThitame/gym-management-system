"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Json } from "@/types/database";
import { normalizeDomain, parseCsvList, parseJsonObject, slugifyEnterpriseName } from "../lib/business-rules";
import {
  BackupJobSchema,
  BranchSchema,
  BranchSettingsSchema,
  BranchUserSchema,
  ComplianceRequestSchema,
  FeatureFlagSchema,
  HealthCheckSchema,
  OrganizationSchema,
  RetentionPolicySchema,
  SecurityEventStatusSchema,
  SubscriptionSchema,
  TenantConfigSchema
} from "../schemas/enterprise";

const enterpriseAdminRoles = ["super_admin", "gym_admin"] as const;
const superAdminRoles = ["super_admin"] as const;

export async function saveOrganizationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/admin/settings");
  const parsed = OrganizationSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug"),
    organizationType: formData.get("organizationType") ?? "single_gym",
    status: formData.get("status") ?? "active",
    primaryDomain: formData.get("primaryDomain") ?? "",
    billingEmail: formData.get("billingEmail") ?? "",
    settings: formData.get("settings") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const settings = parseJsonObject(parsed.data.settings ?? "");
  if (!settings.ok) {
    return fieldError("settings", settings.message);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug || slugifyEnterpriseName(parsed.data.name),
    organization_type: parsed.data.organizationType,
    status: parsed.data.status,
    primary_domain: parsed.data.primaryDomain ? normalizeDomain(parsed.data.primaryDomain) : null,
    billing_email: parsed.data.billingEmail || null,
    settings: settings.value,
    created_by: context.userId
  };
  const result = parsed.data.organizationId
    ? await supabase.from("organizations").update(payload).eq("id", parsed.data.organizationId).select("*").maybeSingle()
    : await supabase.from("organizations").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Organization save failed." };
  }

  await writeEnterpriseAudit(context, parsed.data.organizationId ? "organization.updated" : "organization.created", "organization", result.data.id, {
    name: parsed.data.name,
    type: parsed.data.organizationType
  });
  revalidateEnterprisePaths();
  return { status: "success", message: parsed.data.organizationId ? "Organization updated." : "Organization created." };
}

export async function saveBranchAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = BranchSchema.safeParse({
    branchId: formData.get("branchId") ?? "",
    organizationId: formData.get("organizationId"),
    gymId: formData.get("gymId") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug"),
    branchCode: formData.get("branchCode"),
    status: formData.get("status") ?? "active",
    timezone: formData.get("timezone") ?? "Asia/Kolkata",
    currency: formData.get("currency") ?? "INR",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    country: formData.get("country") ?? "India",
    postalCode: formData.get("postalCode") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    capacity: formData.get("capacity") ?? "0",
    operatingHours: formData.get("operatingHours") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const operatingHours = parseJsonObject(parsed.data.operatingHours ?? "");
  if (!operatingHours.ok) {
    return fieldError("operatingHours", operatingHours.message);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    gym_id: parsed.data.gymId || null,
    name: parsed.data.name,
    slug: parsed.data.slug || slugifyEnterpriseName(parsed.data.name),
    branch_code: parsed.data.branchCode.toUpperCase(),
    status: parsed.data.status,
    timezone: parsed.data.timezone,
    currency: parsed.data.currency.toUpperCase(),
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country,
    postal_code: parsed.data.postalCode || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    capacity: parsed.data.capacity,
    operating_hours: operatingHours.value,
    created_by: context.userId
  };
  const result = parsed.data.branchId
    ? await supabase.from("branches").update(payload).eq("id", parsed.data.branchId).select("*").maybeSingle()
    : await supabase.from("branches").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch save failed." };
  }

  await writeEnterpriseAudit(context, parsed.data.branchId ? "branch.updated" : "branch.created", "branch", result.data.id, {
    organizationId: parsed.data.organizationId,
    branchCode: parsed.data.branchCode
  });
  revalidateEnterprisePaths();
  return { status: "success", message: parsed.data.branchId ? "Branch updated." : "Branch created." };
}

export async function saveBranchUserAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = BranchUserSchema.safeParse({
    branchUserId: formData.get("branchUserId") ?? "",
    organizationId: formData.get("organizationId"),
    branchId: formData.get("branchId"),
    userId: formData.get("userId"),
    roleName: formData.get("roleName") ?? "member",
    branchRole: formData.get("branchRole") ?? "viewer",
    accessScope: formData.get("accessScope") ?? "single_branch",
    status: formData.get("status") ?? "active",
    permissions: formData.get("permissions") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }
  const permissions = parseJsonObject(parsed.data.permissions ?? "");
  if (!permissions.ok) {
    return fieldError("permissions", permissions.message);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    branch_id: parsed.data.branchId,
    user_id: parsed.data.userId,
    role_name: parsed.data.roleName,
    branch_role: parsed.data.branchRole,
    access_scope: parsed.data.accessScope,
    status: parsed.data.status,
    permissions: permissions.value,
    assigned_by: context.userId
  };
  const result = parsed.data.branchUserId
    ? await supabase.from("branch_users").update(payload).eq("id", parsed.data.branchUserId).select("*").maybeSingle()
    : await supabase.from("branch_users").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch user save failed." };
  }

  await writeEnterpriseAudit(context, parsed.data.branchUserId ? "branch_user.updated" : "branch_user.assigned", "branch_user", result.data.id, {
    roleName: parsed.data.roleName,
    branchRole: parsed.data.branchRole
  });
  revalidateEnterprisePaths();
  return { status: "success", message: parsed.data.branchUserId ? "Branch access updated." : "Branch user assigned." };
}

export async function saveBranchSettingsAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = BranchSettingsSchema.safeParse({
    branchSettingsId: formData.get("branchSettingsId") ?? "",
    organizationId: formData.get("organizationId"),
    branchId: formData.get("branchId"),
    generalSettings: formData.get("generalSettings") ?? "",
    membershipSettings: formData.get("membershipSettings") ?? "",
    paymentSettings: formData.get("paymentSettings") ?? "",
    attendanceSettings: formData.get("attendanceSettings") ?? "",
    classSettings: formData.get("classSettings") ?? "",
    notificationSettings: formData.get("notificationSettings") ?? "",
    securitySettings: formData.get("securitySettings") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const parsedObjects = parseManyJson({
    generalSettings: parsed.data.generalSettings ?? "",
    membershipSettings: parsed.data.membershipSettings ?? "",
    paymentSettings: parsed.data.paymentSettings ?? "",
    attendanceSettings: parsed.data.attendanceSettings ?? "",
    classSettings: parsed.data.classSettings ?? "",
    notificationSettings: parsed.data.notificationSettings ?? "",
    securitySettings: parsed.data.securitySettings ?? ""
  });
  if (!parsedObjects.ok) {
    return fieldError(parsedObjects.field, parsedObjects.message);
  }
  const branchSettingsJson = parsedObjects.value;

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    branch_id: parsed.data.branchId,
    general_settings: branchSettingsJson.generalSettings ?? {},
    membership_settings: branchSettingsJson.membershipSettings ?? {},
    payment_settings: branchSettingsJson.paymentSettings ?? {},
    attendance_settings: branchSettingsJson.attendanceSettings ?? {},
    class_settings: branchSettingsJson.classSettings ?? {},
    notification_settings: branchSettingsJson.notificationSettings ?? {},
    security_settings: branchSettingsJson.securitySettings ?? {},
    updated_by: context.userId
  };
  const result = parsed.data.branchSettingsId
    ? await supabase.from("branch_settings").update(payload).eq("id", parsed.data.branchSettingsId).select("*").maybeSingle()
    : await supabase.from("branch_settings").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Branch settings save failed." };
  }

  await writeEnterpriseAudit(context, "branch_settings.updated", "branch_settings", result.data.id, { branchId: parsed.data.branchId });
  revalidateEnterprisePaths();
  return { status: "success", message: "Branch settings saved." };
}

export async function saveTenantConfigAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = TenantConfigSchema.safeParse({
    tenantConfigId: formData.get("tenantConfigId") ?? "",
    organizationId: formData.get("organizationId"),
    tenantKey: formData.get("tenantKey"),
    planTier: formData.get("planTier") ?? "starter",
    status: formData.get("status") ?? "active",
    customDomain: formData.get("customDomain") ?? "",
    subdomain: formData.get("subdomain") ?? "",
    brandName: formData.get("brandName"),
    logoUrl: formData.get("logoUrl") ?? "",
    faviconUrl: formData.get("faviconUrl") ?? "",
    primaryColor: formData.get("primaryColor") ?? "#111315",
    secondaryColor: formData.get("secondaryColor") ?? "#16a34a",
    accentColor: formData.get("accentColor") ?? "#d7ff3f",
    typography: formData.get("typography") ?? "",
    emailBranding: formData.get("emailBranding") ?? "",
    limits: formData.get("limits") ?? "",
    complianceSettings: formData.get("complianceSettings") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const parsedObjects = parseManyJson({
    typography: parsed.data.typography ?? "",
    emailBranding: parsed.data.emailBranding ?? "",
    limits: parsed.data.limits ?? "",
    complianceSettings: parsed.data.complianceSettings ?? ""
  });
  if (!parsedObjects.ok) {
    return fieldError(parsedObjects.field, parsedObjects.message);
  }
  const tenantJson = parsedObjects.value;

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    tenant_key: parsed.data.tenantKey,
    plan_tier: parsed.data.planTier,
    status: parsed.data.status,
    custom_domain: parsed.data.customDomain ? normalizeDomain(parsed.data.customDomain) : null,
    subdomain: parsed.data.subdomain || null,
    brand_name: parsed.data.brandName,
    logo_url: parsed.data.logoUrl || null,
    favicon_url: parsed.data.faviconUrl || null,
    primary_color: parsed.data.primaryColor,
    secondary_color: parsed.data.secondaryColor,
    accent_color: parsed.data.accentColor,
    typography: tenantJson.typography ?? {},
    email_branding: tenantJson.emailBranding ?? {},
    limits: tenantJson.limits ?? {},
    compliance_settings: tenantJson.complianceSettings ?? {},
    updated_by: context.userId
  };
  const result = parsed.data.tenantConfigId
    ? await supabase.from("tenant_configs").update(payload).eq("id", parsed.data.tenantConfigId).select("*").maybeSingle()
    : await supabase.from("tenant_configs").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Tenant config save failed." };
  }

  await writeEnterpriseAudit(context, "tenant_config.updated", "tenant_config", result.data.id, { planTier: parsed.data.planTier });
  revalidateEnterprisePaths();
  return { status: "success", message: "Tenant branding and domain settings saved." };
}

export async function saveFeatureFlagAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = FeatureFlagSchema.safeParse({
    featureFlagId: formData.get("featureFlagId") ?? "",
    organizationId: formData.get("organizationId") ?? "",
    branchId: formData.get("branchId") ?? "",
    flagKey: formData.get("flagKey"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    enabled: checkbox(formData, "enabled"),
    rolloutPercentage: formData.get("rolloutPercentage") ?? "0",
    targetPlanTiers: formData.get("targetPlanTiers") ?? "",
    rules: formData.get("rules") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }
  const rules = parseJsonObject(parsed.data.rules ?? "");
  if (!rules.ok) {
    return fieldError("rules", rules.message);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId || null,
    branch_id: parsed.data.branchId || null,
    flag_key: parsed.data.flagKey,
    name: parsed.data.name,
    description: parsed.data.description || "",
    enabled: parsed.data.enabled,
    rollout_percentage: parsed.data.rolloutPercentage,
    target_plan_tiers: parseCsvList(parsed.data.targetPlanTiers || "starter,professional,enterprise"),
    rules: rules.value,
    status: parsed.data.status,
    created_by: context.userId,
    updated_by: context.userId
  };
  const result = parsed.data.featureFlagId
    ? await supabase.from("feature_flags").update(payload).eq("id", parsed.data.featureFlagId).select("*").maybeSingle()
    : await supabase.from("feature_flags").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Feature flag save failed." };
  }

  await writeEnterpriseAudit(context, "feature_flag.updated", "feature_flag", result.data.id, { flagKey: parsed.data.flagKey, enabled: parsed.data.enabled });
  revalidateEnterprisePaths();
  return { status: "success", message: "Feature flag saved." };
}

export async function saveSubscriptionAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/admin/settings");
  const parsed = SubscriptionSchema.safeParse({
    subscriptionId: formData.get("subscriptionId") ?? "",
    organizationId: formData.get("organizationId"),
    planTier: formData.get("planTier") ?? "starter",
    status: formData.get("status") ?? "trial",
    branchLimit: formData.get("branchLimit") ?? "1",
    memberLimit: formData.get("memberLimit") ?? "500",
    staffLimit: formData.get("staffLimit") ?? "10",
    storageLimitMb: formData.get("storageLimitMb") ?? "1024",
    renewsOn: formData.get("renewsOn") ?? "",
    trialEndsOn: formData.get("trialEndsOn") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    plan_tier: parsed.data.planTier,
    status: parsed.data.status,
    branch_limit: parsed.data.branchLimit,
    member_limit: parsed.data.memberLimit,
    staff_limit: parsed.data.staffLimit,
    storage_limit_mb: parsed.data.storageLimitMb,
    renews_on: parsed.data.renewsOn || null,
    trial_ends_on: parsed.data.trialEndsOn || null,
    created_by: context.userId
  };
  const result = parsed.data.subscriptionId
    ? await supabase.from("platform_subscriptions").update(payload).eq("id", parsed.data.subscriptionId).select("*").maybeSingle()
    : await supabase.from("platform_subscriptions").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Subscription save failed." };
  }

  await writeEnterpriseAudit(context, "platform_subscription.updated", "platform_subscription", result.data.id, { planTier: parsed.data.planTier });
  revalidateEnterprisePaths();
  return { status: "success", message: "Subscription and license limits saved." };
}

export async function saveRetentionPolicyAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = RetentionPolicySchema.safeParse({
    retentionPolicyId: formData.get("retentionPolicyId") ?? "",
    organizationId: formData.get("organizationId") ?? "",
    branchId: formData.get("branchId") ?? "",
    dataCategory: formData.get("dataCategory"),
    retentionDays: formData.get("retentionDays"),
    dispositionAction: formData.get("dispositionAction") ?? "archive",
    legalHold: checkbox(formData, "legalHold"),
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId || null,
    branch_id: parsed.data.branchId || null,
    data_category: parsed.data.dataCategory,
    retention_days: parsed.data.retentionDays,
    disposition_action: parsed.data.dispositionAction,
    legal_hold: parsed.data.legalHold,
    status: parsed.data.status,
    last_reviewed_at: new Date().toISOString(),
    updated_by: context.userId
  };
  const result = parsed.data.retentionPolicyId
    ? await supabase.from("retention_policies").update(payload).eq("id", parsed.data.retentionPolicyId).select("*").maybeSingle()
    : await supabase.from("retention_policies").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Retention policy save failed." };
  }

  await writeEnterpriseAudit(context, "retention_policy.updated", "retention_policy", result.data.id, { dataCategory: parsed.data.dataCategory });
  revalidateEnterprisePaths();
  return { status: "success", message: "Retention policy saved." };
}

export async function saveComplianceRequestAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = ComplianceRequestSchema.safeParse({
    complianceRequestId: formData.get("complianceRequestId") ?? "",
    organizationId: formData.get("organizationId") ?? "",
    branchId: formData.get("branchId") ?? "",
    requestType: formData.get("requestType"),
    requesterEmail: formData.get("requesterEmail"),
    status: formData.get("status") ?? "open",
    dueAt: formData.get("dueAt") ?? "",
    notes: formData.get("notes") ?? "",
    metadata: formData.get("metadata") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }
  const metadata = parseJsonObject(parsed.data.metadata ?? "");
  if (!metadata.ok) {
    return fieldError("metadata", metadata.message);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId || null,
    branch_id: parsed.data.branchId || null,
    request_type: parsed.data.requestType,
    requester_email: parsed.data.requesterEmail,
    status: parsed.data.status,
    due_at: parsed.data.dueAt || null,
    completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
    notes: parsed.data.notes || null,
    metadata: metadata.value,
    requested_by: context.userId
  };
  const result = parsed.data.complianceRequestId
    ? await supabase.from("compliance_requests").update(payload).eq("id", parsed.data.complianceRequestId).select("*").maybeSingle()
    : await supabase.from("compliance_requests").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Compliance request save failed." };
  }

  await writeEnterpriseAudit(context, "compliance_request.updated", "compliance_request", result.data.id, { requestType: parsed.data.requestType });
  revalidateEnterprisePaths();
  return { status: "success", message: "Compliance request saved." };
}

export async function queueBackupJobAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = BackupJobSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    branchId: formData.get("branchId") ?? "",
    backupType: formData.get("backupType") ?? "configuration",
    scope: formData.get("scope") ?? "tenant",
    metadata: formData.get("metadata") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }
  const metadata = parseJsonObject(parsed.data.metadata ?? "");
  if (!metadata.ok) {
    return fieldError("metadata", metadata.message);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("backup_jobs").insert({
    organization_id: parsed.data.organizationId || null,
    branch_id: parsed.data.branchId || null,
    backup_type: parsed.data.backupType,
    scope: parsed.data.scope,
    status: "queued",
    requested_by: context.userId,
    metadata: metadata.value
  }).select("*").maybeSingle();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Backup queue failed." };
  }

  await writeEnterpriseAudit(context, "backup_job.queued", "backup_job", data.id, { backupType: parsed.data.backupType, scope: parsed.data.scope });
  revalidateEnterprisePaths();
  return { status: "success", message: "Backup job queued for the operations runbook." };
}

export async function recordHealthCheckAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = HealthCheckSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    branchId: formData.get("branchId") ?? "",
    checkKey: formData.get("checkKey"),
    component: formData.get("component") ?? "api",
    status: formData.get("status") ?? "healthy",
    latencyMs: formData.get("latencyMs") || undefined,
    message: formData.get("message") ?? "",
    metadata: formData.get("metadata") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }
  const metadata = parseJsonObject(parsed.data.metadata ?? "");
  if (!metadata.ok) {
    return fieldError("metadata", metadata.message);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("system_health_checks").insert({
    organization_id: parsed.data.organizationId || null,
    branch_id: parsed.data.branchId || null,
    check_key: parsed.data.checkKey,
    component: parsed.data.component,
    status: parsed.data.status,
    latency_ms: parsed.data.latencyMs ?? null,
    message: parsed.data.message || null,
    metadata: metadata.value
  }).select("*").maybeSingle();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Health check save failed." };
  }

  await writeEnterpriseAudit(context, "system_health.recorded", "system_health_check", data.id, { component: parsed.data.component, status: parsed.data.status });
  revalidateEnterprisePaths();
  return { status: "success", message: "Health check recorded." };
}

export async function updateSecurityEventStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = SecurityEventStatusSchema.safeParse({
    securityEventId: formData.get("securityEventId"),
    status: formData.get("status") ?? "investigating"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("security_events").update({
    status: parsed.data.status,
    resolved_at: parsed.data.status === "resolved" || parsed.data.status === "dismissed" ? new Date().toISOString() : null
  }).eq("id", parsed.data.securityEventId).select("*").maybeSingle();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Security event update failed." };
  }

  await writeEnterpriseAudit(context, "security_event.status_updated", "security_event", data.id, { status: parsed.data.status });
  revalidateEnterprisePaths();
  return { status: "success", message: "Security event status updated." };
}

function parseManyJson(values: Record<string, string>) {
  const parsed: Record<string, Json> = {};
  for (const [field, value] of Object.entries(values)) {
    const result = parseJsonObject(value);
    if (!result.ok) {
      return { ok: false as const, field, message: result.message };
    }
    parsed[field] = result.value;
  }
  return { ok: true as const, value: parsed };
}

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value?.length)) as Record<string, string[]>
  };
}

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

async function writeEnterpriseAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action,
    entityType,
    entityId,
    metadata
  });
}

function revalidateEnterprisePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
}
