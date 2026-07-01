"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import {
  BranchSchema,
  BranchSettingSchema,
  FeatureFlagSchema,
  TenantDomainSchema
} from "../schemas/branch";

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}

export async function saveBranchAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/settings");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }
  const parsed = BranchSchema.safeParse({
    branchId: formData.get("branchId") ?? "",
    name: formData.get("name"),
    branchCode: formData.get("branchCode"),
    status: formData.get("status"),
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    country: formData.get("country") ?? "",
    address: formData.get("address") ?? "",
    capacity: formData.get("capacity") ?? "100",
    timezone: formData.get("timezone") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const branchId = parsed.data.branchId || null;
  const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const payload = {
    gym_id: scope.gymId,
    organization_id: scope.organizationId!,
    name: parsed.data.name,
    slug,
    branch_code: parsed.data.branchCode,
    status: parsed.data.status,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country || "India",
    address: parsed.data.address || null,
    capacity: parsed.data.capacity,
    currency: "INR",
    metadata: {}
  };

  if (branchId) {
    const { error } = await supabase.from("branches").update(payload).eq("id", branchId);
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "update", entityType: "branches", entityId: branchId, metadata: payload });
  } else {
    const { data, error } = await supabase.from("branches").insert(payload).select("id").maybeSingle();
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "create", entityType: "branches", entityId: data?.id ?? null, metadata: payload });
  }

  revalidatePath("/admin/settings");
  return { status: "success", message: branchId ? "Branch updated." : "Branch created." };
}

export async function saveBranchSettingAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/settings");
  const parsed = BranchSettingSchema.safeParse({
    settingId: formData.get("settingId") ?? "",
    branchId: formData.get("branchId"),
    settingKey: formData.get("settingKey"),
    settingValue: formData.get("settingValue"),
    scope: formData.get("scope") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const settingId = parsed.data.settingId || null;
  const payload = {
    branch_id: parsed.data.branchId,
    general_settings: { [parsed.data.settingKey]: parsed.data.settingValue }
  } as any;

  if (settingId) {
    const { error } = await supabase.from("branch_settings").update(payload).eq("id", settingId);
    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase.from("branch_settings").insert(payload);
    if (error) return { status: "error", message: error.message };
  }

  revalidatePath("/admin/settings");
  return { status: "success", message: settingId ? "Setting updated." : "Setting created." };
}

export async function saveFeatureFlagAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/settings");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }
  const parsed = FeatureFlagSchema.safeParse({
    flagId: formData.get("flagId") ?? "",
    branchId: formData.get("branchId"),
    name: formData.get("name"),
    flagKey: formData.get("flagKey"),
    description: formData.get("description") ?? "",
    enabled: Boolean(formData.get("enabled")),
    status: formData.get("status"),
    rolloutPercentage: formData.get("rolloutPercentage") ?? "0"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const flagId = parsed.data.flagId || null;
  const payload = {
    branch_id: parsed.data.branchId,
    organization_id: scope.organizationId!,
    name: parsed.data.name,
    flag_key: parsed.data.flagKey,
    description: parsed.data.description || null,
    enabled: parsed.data.enabled,
    status: parsed.data.status,
    rollout_percentage: parsed.data.rolloutPercentage
  } as any;

  if (flagId) {
    const { error } = await supabase.from("feature_flags").update(payload).eq("id", flagId);
    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase.from("feature_flags").insert(payload);
    if (error) return { status: "error", message: error.message };
  }

  revalidatePath("/admin/settings");
  return { status: "success", message: flagId ? "Feature flag updated." : "Feature flag created." };
}

export async function saveTenantDomainAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/settings");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }
  const parsed = TenantDomainSchema.safeParse({
    domainId: formData.get("domainId") ?? "",
    domain: formData.get("domain"),
    domainType: formData.get("domainType"),
    routingMode: formData.get("routingMode"),
    isPrimary: Boolean(formData.get("isPrimary")),
    sslStatus: formData.get("sslStatus") ?? "pending"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const domainId = parsed.data.domainId || null;
  const payload = {
    organization_id: scope.organizationId!,
    gym_id: scope.gymId,
    domain: parsed.data.domain,
    domain_type: parsed.data.domainType,
    routing_mode: parsed.data.routingMode,
    is_primary: parsed.data.isPrimary,
    ssl_status: parsed.data.sslStatus,
    status: "pending" as const,
    metadata: {}
  };

  if (domainId) {
    const { error } = await supabase.from("tenant_domains").update(payload).eq("id", domainId);
    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase.from("tenant_domains").insert(payload);
    if (error) return { status: "error", message: error.message };
  }

  revalidatePath("/admin/settings");
  return { status: "success", message: domainId ? "Domain updated." : "Domain created." };
}
