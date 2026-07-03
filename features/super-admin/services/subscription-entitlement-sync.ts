import "server-only";

import { syncOrganizationEntitlements, syncOrganizationUsageLimits } from "@/features/subscription/entitlement-sync-service";

export async function syncSubscriptionArtifactsForOrganization(
  organizationId: string,
  reason: string,
): Promise<void> {
  const [entitlementResult, limitResult] = await Promise.all([
    syncOrganizationEntitlements(organizationId, reason),
    syncOrganizationUsageLimits(organizationId, reason),
  ]);

  if (!entitlementResult.ok) {
    throw new Error(entitlementResult.error);
  }

  if (!limitResult.ok) {
    throw new Error(limitResult.error);
  }
}
