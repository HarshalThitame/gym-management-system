"use server";

import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getAuditTrail, type AuditTrailFilters } from "@/features/organization-owner/services/audit-trail-service";

export async function getAuditTrailAction(filters: AuditTrailFilters) {
  const ctx = await requireOrganizationOwner("/organization/security");
  return getAuditTrail(ctx.organizationId, filters);
}
