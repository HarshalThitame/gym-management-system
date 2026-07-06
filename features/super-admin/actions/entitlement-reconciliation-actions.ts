"use server";

import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import {
  applyEntitlementReconciliation,
  buildEntitlementReconciliationPreview,
  listEntitlementReconciliationRuns,
  type EntitlementReconciliationScope,
} from "../services/entitlement-reconciliation-service";

const superAdminRoles = ["super_admin"] as const;

function parseScope(formData: FormData): EntitlementReconciliationScope {
  const scopeType = formData.get("scopeType");
  const scopeId = formData.get("scopeId");
  return {
    scopeType: scopeType === "organization" ? "organization" : "all",
    scopeId: typeof scopeId === "string" && scopeId.trim() ? scopeId.trim() : null,
  };
}

function scopeLabel(scope: EntitlementReconciliationScope) {
  return scope.scopeType === "organization" ? `organization:${scope.scopeId ?? "unknown"}` : "all organizations";
}

async function requireSuperAdmin() {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) {
    throw new Error("Super Admin access is required.");
  }
  return auth;
}

export async function previewEntitlementReconciliationAction(_prevState: unknown, formData: FormData) {
  void _prevState;
  const auth = await requireSuperAdmin();
  const scope = parseScope(formData);
  const result = await buildEntitlementReconciliationPreview(scope);
  await writeAuditLog({
    actorId: auth.context.userId,
    action: "entitlement.reconciliation.preview",
    entityType: "organization",
    entityId: scope.scopeId,
    metadata: {
      scopeType: scope.scopeType,
      runId: result.runId,
      summary: result.summary,
    } as never,
  });
  revalidatePath("/super-admin/feature-audit");
  return {
    status: "success",
    message: `Preview completed for ${scopeLabel(scope)}.`,
    runId: result.runId,
    summary: result.summary,
    differences: result.differences,
  };
}

export async function applyEntitlementReconciliationAction(_prevState: unknown, formData: FormData) {
  void _prevState;
  const auth = await requireSuperAdmin();
  const scope = parseScope(formData);
  const result = await applyEntitlementReconciliation(scope, auth.context.userId);
  await writeAuditLog({
    actorId: auth.context.userId,
    action: "entitlement.reconciliation.apply",
    entityType: "organization",
    entityId: scope.scopeId,
    metadata: {
      scopeType: scope.scopeType,
      summary: result.summary,
      runId: result.runId,
    } as never,
  });
  revalidatePath("/super-admin/feature-audit");
  return {
    status: "success",
    message: `Applied reconciliation for ${scopeLabel(scope)}.`,
    runId: result.runId,
    summary: result.summary,
    differences: result.differences,
  };
}

export async function getEntitlementReconciliationRunsAction(limit = 10) {
  await requireSuperAdmin();
  return listEntitlementReconciliationRuns(limit);
}
