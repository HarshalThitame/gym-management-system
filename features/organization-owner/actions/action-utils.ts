import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Json } from "@/types/database";

export type OrgOwnerActionState = AuthActionState & {
  organizationId?: string;
};

export async function getOrgOwnerContext(nextPath: string) {
  const context = await requireOrganizationOwner(nextPath);
  return { ...context, organizationId: context.organizationId };
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
