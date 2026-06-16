"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertFeature, isWithinBranchLimit } from "@/lib/tenant";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Database, Json } from "@/types/database";
import { isFullTenantDomain, normalizeDomain, parseCsvList, parseJsonObject, slugifyEnterpriseName } from "../lib/business-rules";
import { isSystemTenantDomain } from "../lib/domain-rules";
import {
  BackupJobSchema,
  BranchSchema,
  BranchSettingsSchema,
  BranchUserSchema,
  ComplianceRequestSchema,
  FeatureFlagSchema,
  HealthCheckSchema,
  GymSchema,
  OrganizationSchema,
  RetentionPolicySchema,
  SecurityEventStatusSchema,
  SubscriptionSchema,
  TenantConfigSchema,
  TenantDomainLifecycleSchema,
  TenantDomainSchema
} from "../schemas/enterprise";

const enterpriseAdminRoles = ["super_admin", "organization_owner", "gym_admin"] as const;
const superAdminRoles = ["super_admin"] as const;

export async function saveOrganizationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/admin/settings");
  const parsed = OrganizationSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug"),
    status: formData.get("status") ?? "active",
    primaryDomain: formData.get("primaryDomain") ?? "",
    billingEmail: formData.get("billingEmail") ?? "",
    settings: latestFormString(formData, "settings")
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
    type: "subscription_based"
  });
  revalidateEnterprisePaths();
  return { status: "success", message: parsed.data.organizationId ? "Organization updated." : "Organization created." };
}

export async function saveGymAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/gyms");
  const parsed = GymSchema.safeParse({
    gymId: formData.get("gymId") ?? "",
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone") ?? "Asia/Kolkata",
    currency: formData.get("currency") ?? "INR",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  if (!parsed.data.gymId) {
    const branchLimitError = await requireLocationCapacity(supabase, parsed.data.organizationId, "gyms");
    if (branchLimitError) {
      return branchLimitError;
    }
  }
  const payload = {
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    slug: parsed.data.slug || slugifyEnterpriseName(parsed.data.name),
    timezone: parsed.data.timezone,
    currency: parsed.data.currency.toUpperCase(),
    status: parsed.data.status
  };
  const result = parsed.data.gymId
    ? await supabase.from("gyms").update(payload).eq("id", parsed.data.gymId).select("*").maybeSingle()
    : await supabase.from("gyms").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Gym save failed." };
  }

  await writeEnterpriseAudit(context, parsed.data.gymId ? "gym.updated" : "gym.created", "gym", result.data.id, {
    organizationId: parsed.data.organizationId,
    status: parsed.data.status
  });
  revalidateEnterprisePaths();
  return { status: "success", message: parsed.data.gymId ? "Gym updated." : "Gym created." };
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
    operatingHours: latestFormString(formData, "operatingHours")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const operatingHours = parseJsonObject(parsed.data.operatingHours ?? "");
  if (!operatingHours.ok) {
    return fieldError("operatingHours", operatingHours.message);
  }

  const supabase = await createSupabaseServerClient();
  if (!parsed.data.branchId) {
    const branchLimitError = await requireLocationCapacity(supabase, parsed.data.organizationId, "branches");
    if (branchLimitError) {
      return branchLimitError;
    }
  }
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
    permissions: latestFormString(formData, "permissions")
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
    generalSettings: latestFormString(formData, "generalSettings"),
    membershipSettings: latestFormString(formData, "membershipSettings"),
    paymentSettings: latestFormString(formData, "paymentSettings"),
    attendanceSettings: latestFormString(formData, "attendanceSettings"),
    classSettings: latestFormString(formData, "classSettings"),
    notificationSettings: latestFormString(formData, "notificationSettings"),
    securitySettings: latestFormString(formData, "securitySettings")
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
    typography: latestFormString(formData, "typography"),
    emailBranding: latestFormString(formData, "emailBranding"),
    limits: latestFormString(formData, "limits"),
    complianceSettings: latestFormString(formData, "complianceSettings")
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

export async function saveTenantDomainAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = TenantDomainSchema.safeParse({
    tenantDomainId: formData.get("tenantDomainId") ?? "",
    organizationId: formData.get("organizationId"),
    branchId: formData.get("branchId") ?? "",
    gymId: formData.get("gymId") ?? "",
    tenantConfigId: formData.get("tenantConfigId") ?? "",
    domain: formData.get("domain"),
    domainType: formData.get("domainType") ?? "custom_domain",
    routingMode: formData.get("routingMode") ?? "organization",
    status: formData.get("status") ?? "pending",
    isPrimary: checkbox(formData, "isPrimary")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const normalizedDomain = normalizeDomain(parsed.data.domain);
  if (!normalizedDomain || !isFullTenantDomain(normalizedDomain)) {
    return fieldError("domain", "Enter a full domain such as apexfit.com or bandra.apexfit.com.");
  }

  if (isSystemTenantDomain({ domain: normalizedDomain, domain_type: parsed.data.domainType })) {
    return fieldError("domain", "System deployment domains are managed automatically and cannot be added here.");
  }

  const supabase = await createSupabaseServerClient();
  const featureError = await requireCustomDomainFeature(parsed.data.organizationId);
  if (featureError) {
    return featureError;
  }
  const branchId = parsed.data.branchId || null;
  let gymId = parsed.data.gymId || null;

  if (branchId) {
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id,organization_id,gym_id")
      .eq("id", branchId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();

    if (branchError) {
      return { status: "error", message: branchError.message };
    }

    if (!branch) {
      return fieldError("branchId", "Selected branch is not accessible for this organization.");
    }

    gymId = gymId ?? branch.gym_id;
  }

  if (parsed.data.tenantConfigId) {
    const { data: tenantConfig, error: tenantConfigError } = await supabase
      .from("tenant_configs")
      .select("id,organization_id")
      .eq("id", parsed.data.tenantConfigId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();

    if (tenantConfigError) {
      return { status: "error", message: tenantConfigError.message };
    }

    if (!tenantConfig) {
      return fieldError("tenantConfigId", "Selected tenant config is not accessible for this organization.");
    }
  }

  if (parsed.data.isPrimary) {
    const unsetResult = await supabase
      .from("tenant_domains")
      .update({ is_primary: false })
      .eq("organization_id", parsed.data.organizationId)
      .neq("id", parsed.data.tenantDomainId || "00000000-0000-0000-0000-000000000000");

    if (unsetResult.error) {
      return { status: "error", message: unsetResult.error.message };
    }
  }

  const payload = {
    organization_id: parsed.data.organizationId,
    branch_id: branchId,
    gym_id: gymId,
    tenant_config_id: parsed.data.tenantConfigId || null,
    domain: normalizedDomain,
    domain_type: parsed.data.domainType,
    routing_mode: parsed.data.routingMode,
    status: parsed.data.status,
    is_primary: parsed.data.status === "disabled" ? false : parsed.data.isPrimary,
    ssl_status: parsed.data.status === "disabled" ? "not_applicable" as const : "pending" as const,
    verified_at: null,
    last_checked_at: null,
    metadata: {
      source: "admin_domain_registry",
      managed_by: "apex",
      lifecycle: parsed.data.status
    } satisfies Json,
    created_by: context.userId
  };
  const result = parsed.data.tenantDomainId
    ? await supabase.from("tenant_domains").update(payload).eq("id", parsed.data.tenantDomainId).select("*").maybeSingle()
    : await supabase.from("tenant_domains").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Tenant domain save failed." };
  }

  await syncTenantConfigDomainFields(supabase, result.data);
  await writeEnterpriseAudit(context, parsed.data.tenantDomainId ? "tenant_domain.updated" : "tenant_domain.created", "tenant_domain", result.data.id, {
    domain: normalizedDomain,
    routingMode: parsed.data.routingMode,
    isPrimary: parsed.data.isPrimary
  });
  revalidateEnterprisePaths();
  return { status: "success", message: parsed.data.tenantDomainId ? "Tenant domain updated." : "Tenant domain created. Add it to Vercel, configure DNS, then verify it." };
}

export async function updateTenantDomainLifecycleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(enterpriseAdminRoles, "/admin/settings");
  const parsed = TenantDomainLifecycleSchema.safeParse({
    tenantDomainId: formData.get("tenantDomainId"),
    action: formData.get("action")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: domain, error } = await supabase.from("tenant_domains").select("*").eq("id", parsed.data.tenantDomainId).maybeSingle();

  if (error || !domain) {
    return { status: "error", message: error?.message ?? "Tenant domain was not found." };
  }

  if (parsed.data.action !== "set_primary" && isSystemTenantDomain(domain)) {
    return { status: "error", message: "System deployment domains cannot be disabled or restored from the tenant registry." };
  }

  if (!isSystemTenantDomain(domain)) {
    const featureError = await requireCustomDomainFeature(domain.organization_id);
    if (featureError) {
      return featureError;
    }
  }

  if (parsed.data.action === "set_primary") {
    const unsetResult = await supabase.from("tenant_domains").update({ is_primary: false }).eq("organization_id", domain.organization_id).neq("id", domain.id);
    if (unsetResult.error) {
      return { status: "error", message: unsetResult.error.message };
    }

    const { data, error: updateError } = await supabase.from("tenant_domains").update({ is_primary: true }).eq("id", domain.id).select("*").maybeSingle();
    if (updateError || !data) {
      return { status: "error", message: updateError?.message ?? "Primary domain update failed." };
    }

    await syncTenantConfigDomainFields(supabase, data);
  } else if (parsed.data.action === "disable") {
    const { data, error: updateError } = await supabase
      .from("tenant_domains")
      .update({ status: "disabled", is_primary: false, ssl_status: "not_applicable" })
      .eq("id", domain.id)
      .select("*")
      .maybeSingle();
    if (updateError || !data) {
      return { status: "error", message: updateError?.message ?? "Domain disable failed." };
    }

    await syncTenantConfigDomainFields(supabase, data);
  } else {
    const { data, error: updateError } = await supabase
      .from("tenant_domains")
      .update({ status: "pending", ssl_status: "pending", verified_at: null, last_checked_at: null })
      .eq("id", domain.id)
      .select("*")
      .maybeSingle();
    if (updateError || !data) {
      return { status: "error", message: updateError?.message ?? "Domain restore failed." };
    }

    await syncTenantConfigDomainFields(supabase, data);
  }

  await writeEnterpriseAudit(context, `tenant_domain.${parsed.data.action}`, "tenant_domain", domain.id, {
    domain: domain.domain,
    action: parsed.data.action
  });
  revalidateEnterprisePaths();
  return { status: "success", message: "Tenant domain lifecycle updated." };
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
    rules: latestFormString(formData, "rules"),
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
    metadata: latestFormString(formData, "metadata")
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
    metadata: latestFormString(formData, "metadata")
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
    metadata: latestFormString(formData, "metadata")
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

function latestFormString(formData: FormData, name: string) {
  const values = formData.getAll(name).filter((value): value is string => typeof value === "string");
  return values.at(-1) ?? "";
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

async function requireLocationCapacity(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  table: "gyms" | "branches"
): Promise<AuthActionState | null> {
  try {
    const currentCount = await getOrganizationLocationCount(supabase, organizationId, table);
    const withinLimit = await isWithinBranchLimit(organizationId, currentCount);
    if (!withinLimit) {
      return { status: "error", message: "Branch limit reached for your current plan. Please upgrade to add more locations." };
    }

    return null;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Branch limit reached for your current plan. Please upgrade to add more locations." };
  }
}

async function getOrganizationLocationCount(supabase: SupabaseClient<Database>, organizationId: string, table: "gyms" | "branches") {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("status", "archived");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function requireCustomDomainFeature(organizationId: string | null): Promise<AuthActionState | null> {
  if (!organizationId) {
    return { status: "error", message: "Feature not available on your current plan." };
  }

  try {
    await assertFeature(organizationId, "customDomainEnabled");
    return null;
  } catch (error) {
    return { status: "error", message: featureGateMessage(error) };
  }
}

function featureGateMessage(error: unknown) {
  return error instanceof Error ? error.message : "Feature not available on your current plan.";
}

async function syncTenantConfigDomainFields(supabase: SupabaseClient<Database>, domain: Database["public"]["Tables"]["tenant_domains"]["Row"]) {
  if (!domain.tenant_config_id || domain.domain_type === "system") {
    return;
  }

  const domainStatus = domain.status === "verified" ? "verified" : domain.status === "failed" ? "failed" : domain.status === "disabled" ? "not_configured" : "pending";

  if (domain.status === "disabled") {
    const { data: tenantConfig } = await supabase
      .from("tenant_configs")
      .select("custom_domain,subdomain")
      .eq("id", domain.tenant_config_id)
      .maybeSingle();
    const patch: Database["public"]["Tables"]["tenant_configs"]["Update"] = {
      domain_status: domainStatus
    };

    if (domain.domain_type === "custom_domain" && normalizeDomain(tenantConfig?.custom_domain ?? "") === domain.normalized_domain) {
      patch.custom_domain = null;
    }

    if (domain.domain_type === "subdomain" && normalizeDomain(tenantConfig?.subdomain ?? "") === domain.normalized_domain) {
      patch.subdomain = null;
    }

    await supabase.from("tenant_configs").update(patch).eq("id", domain.tenant_config_id);
    return;
  }

  const patch: Database["public"]["Tables"]["tenant_configs"]["Update"] = {
    domain_status: domainStatus
  };

  if (domain.domain_type === "custom_domain" && domain.is_primary) {
    patch.custom_domain = domain.normalized_domain ?? domain.domain;
  }

  if (domain.domain_type === "subdomain") {
    patch.subdomain = domain.normalized_domain ?? domain.domain;
  }

  await supabase.from("tenant_configs").update(patch).eq("id", domain.tenant_config_id);
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
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin/gyms");
  revalidatePath("/super-admin/domains");
  revalidatePath("/super-admin/subscriptions");
  revalidatePath("/super-admin/billing");
  revalidatePath("/super-admin/users");
  revalidatePath("/super-admin/roles");
  revalidatePath("/super-admin/settings");
  revalidatePath("/super-admin/white-label");
  revalidatePath("/super-admin/support");
  revalidatePath("/super-admin/security");
  revalidatePath("/super-admin/analytics");
  revalidatePath("/super-admin/monitoring");
  revalidatePath("/super-admin/backups");
  revalidatePath("/super-admin/audit-logs");
  revalidatePath("/super-admin/feature-flags");
}
