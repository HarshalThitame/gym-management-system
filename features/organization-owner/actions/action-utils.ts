import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { checkSubscriptionStatus } from "@/lib/tenant/subscription-guard";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Json } from "@/types/database";

export type OrgOwnerActionState = AuthActionState & {
  organizationId?: string;
};

export async function getOrgOwnerContext(nextPath: string) {
  const context = await requireOrganizationOwner(nextPath);
  const orgId = context.organizationId;

  // Subscription check: every org-owner action requires active or trial subscription
  const subStatus = await checkSubscriptionStatus(orgId);
  if (!subStatus.ok) {
    throw new Error(subStatus.error ?? "Subscription is not active. Please contact support.");
  }

  return { ...context, organizationId: orgId };
}

export async function auditOrgAction(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>
) {
  await writeAuditLog({
    actorId,
    action: `organization_owner.${action}`,
    entityType,
    entityId,
    metadata: (metadata ?? {}) as Json
  });
}

export function revalidateOrgModules(paths?: string[]) {
  revalidatePath("/organization");
  if (paths) paths.forEach((path) => revalidatePath(path));
}
