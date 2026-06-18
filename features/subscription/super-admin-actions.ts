"use server";

import { requireRole } from "@/lib/auth/guards";
import { syncOrganizationEntitlements, syncOrganizationUsageLimits } from "./entitlement-sync-service";

export async function syncEntitlementsAction(
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["super_admin"], "/super-admin");
  return syncOrganizationEntitlements(organizationId, "Entitlements manually synced by Super Admin.");
}

export async function syncUsageLimitsAction(
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["super_admin"], "/super-admin");
  return syncOrganizationUsageLimits(organizationId, "Usage limits manually synced by Super Admin.");
}
