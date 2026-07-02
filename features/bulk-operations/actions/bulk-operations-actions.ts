"use server";

import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  executeBulkDelete,
  executeBulkUpdate,
  executeBulkAssign,
  getBulkOperation,
  getBulkOperations,
  getBulkOperationItems,
  cancelBulkOperation,
  type BulkOperationType
} from "../services/bulk-operations-service";

export async function bulkDeleteAction(params: {
  entityType: string;
  entityIds: string[];
}) {
  const scope = await requireGymAdminScope("/admin");
  
  const operation = await executeBulkDelete({
    entityType: params.entityType,
    entityIds: params.entityIds,
    organizationId: scope.scopedOrganizationId,
    gymId: scope.gymId,
    createdBy: scope.userId
  });

  await writeAuditLog({
    actorId: scope.userId,
    action: "bulk.delete",
    entityType: params.entityType,
    entityId: operation.id,
    metadata: { 
      count: params.entityIds.length,
      operationId: operation.id 
    }
  });

  return operation;
}

export async function bulkUpdateAction(params: {
  entityType: string;
  entityIds: string[];
  updates: Record<string, any>;
}) {
  const scope = await requireGymAdminScope("/admin");
  
  const operation = await executeBulkUpdate({
    entityType: params.entityType,
    entityIds: params.entityIds,
    updates: params.updates,
    organizationId: scope.scopedOrganizationId,
    gymId: scope.gymId,
    createdBy: scope.userId
  });

  await writeAuditLog({
    actorId: scope.userId,
    action: "bulk.update",
    entityType: params.entityType,
    entityId: operation.id,
    metadata: { 
      count: params.entityIds.length,
      operationId: operation.id,
      updates: params.updates
    }
  });

  return operation;
}

export async function bulkAssignAction(params: {
  entityType: string;
  entityIds: string[];
  assignTo: string;
}) {
  const scope = await requireGymAdminScope("/admin");
  
  const operation = await executeBulkAssign({
    entityType: params.entityType,
    entityIds: params.entityIds,
    assignTo: params.assignTo,
    organizationId: scope.scopedOrganizationId,
    gymId: scope.gymId,
    createdBy: scope.userId
  });

  await writeAuditLog({
    actorId: scope.userId,
    action: "bulk.assign",
    entityType: params.entityType,
    entityId: operation.id,
    metadata: { 
      count: params.entityIds.length,
      operationId: operation.id,
      assignTo: params.assignTo
    }
  });

  return operation;
}

export async function getBulkOperationAction(operationId: string) {
  await requireGymAdminScope("/admin");
  return getBulkOperation(operationId);
}

export async function getBulkOperationsAction(params?: {
  limit?: number;
}) {
  const scope = await requireGymAdminScope("/admin");
  return getBulkOperations({
    organizationId: scope.scopedOrganizationId,
    gymId: scope.gymId,
    limit: params?.limit
  });
}

export async function getBulkOperationItemsAction(operationId: string) {
  await requireGymAdminScope("/admin");
  return getBulkOperationItems(operationId);
}

export async function cancelBulkOperationAction(operationId: string) {
  const scope = await requireGymAdminScope("/admin");
  await cancelBulkOperation(operationId);
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "bulk.cancel",
    entityType: "bulk_operations",
    entityId: operationId
  });
}
