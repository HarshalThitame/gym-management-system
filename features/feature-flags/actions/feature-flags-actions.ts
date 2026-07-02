"use server";

import { revalidatePath } from "next/cache";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  getFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  getOrgFeatureFlags,
  setOrgFeatureFlag,
} from "../services/feature-flags-service";

export async function getFeatureFlagsAction() {
  await requireGymAdminScope("/admin/feature-flags");
  return getFeatureFlags();
}

export async function createFeatureFlagAction(formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/feature-flags");
  const key = formData.get("key") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const defaultEnabled = formData.get("defaultEnabled") === "true";

  if (!key || !name) return;

  try {
    await createFeatureFlag({
      key,
      name,
      description,
      category: category || "general",
      default_enabled: defaultEnabled,
      rollout_percentage: 100,
    });
    await writeAuditLog({ actorId: scope.userId, action: "feature_flag.created", entityType: "feature_flag" });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/feature-flags");
}

export async function updateFeatureFlagAction(id: string, formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/feature-flags");
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const defaultEnabled = formData.get("defaultEnabled") === "true";
  const rolloutPercentage = formData.get("rolloutPercentage") as string;

  try {
    await updateFeatureFlag(id, {
      name,
      description,
      default_enabled: defaultEnabled,
      rollout_percentage: rolloutPercentage ? parseInt(rolloutPercentage) : 100,
    } as Record<string, unknown>);
    await writeAuditLog({ actorId: scope.userId, action: "feature_flag.updated", entityType: "feature_flag", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/feature-flags");
}

export async function deleteFeatureFlagAction(id: string): Promise<void> {
  const scope = await requireGymAdminScope("/admin/feature-flags");

  try {
    await deleteFeatureFlag(id);
    await writeAuditLog({ actorId: scope.userId, action: "feature_flag.deleted", entityType: "feature_flag", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/feature-flags");
}

export async function getOrgFeatureFlagsAction() {
  const scope = await requireGymAdminScope("/admin/feature-flags");
  return getOrgFeatureFlags(scope.scopedOrganizationId ?? scope.organizationId);
}

export async function toggleOrgFeatureFlagAction(featureFlagId: string, enabled: boolean): Promise<void> {
  const scope = await requireGymAdminScope("/admin/feature-flags");

  try {
    await setOrgFeatureFlag(scope.scopedOrganizationId ?? scope.organizationId, featureFlagId, enabled);
    await writeAuditLog({ actorId: scope.userId, action: `org_feature_flag.${enabled ? "enabled" : "disabled"}`, entityType: "org_feature_flag", entityId: featureFlagId });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/feature-flags");
}
