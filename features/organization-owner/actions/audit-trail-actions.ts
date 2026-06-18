"use server";

import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getAuditTrail, type AuditTrailFilters } from "@/features/organization-owner/services/audit-trail-service";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export async function getAuditTrailAction(filters: AuditTrailFilters) {
  const ctx = await requireOrganizationOwner("/organization/security");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "audit_logs", actionName: "audit_trail.read" });
  return getAuditTrail(ctx.organizationId, filters);
}
