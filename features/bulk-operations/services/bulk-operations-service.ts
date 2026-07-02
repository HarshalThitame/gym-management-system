import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type BulkOperation = Database["public"]["Tables"]["bulk_operations"]["Row"];
export type BulkOperationItem = Database["public"]["Tables"]["bulk_operation_items"]["Row"];

export type BulkOperationType = "update" | "delete" | "assign" | "export" | "import";
export type BulkOperationStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export async function createBulkOperation(params: {
  organizationId?: string;
  gymId?: string;
  operationType: BulkOperationType;
  entityType: string;
  totalCount: number;
  createdBy: string;
  metadata?: Record<string, unknown>;
}): Promise<BulkOperation> {
  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from("bulk_operations")
    .insert({
      organization_id: params.organizationId,
      gym_id: params.gymId,
      operation_type: params.operationType,
      entity_type: params.entityType,
      status: "pending",
      total_count: params.totalCount,
      created_by: params.createdBy,
      metadata: params.metadata ?? {}
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addBulkOperationItems(
  operationId: string,
  entityIds: string[]
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const items = entityIds.map(entityId => ({
    operation_id: operationId,
    entity_id: entityId,
    status: "pending" as const
  }));

  const { error } = await supabase
    .from("bulk_operation_items")
    .insert(items);

  if (error) throw error;
}

export async function updateBulkOperationStatus(
  operationId: string,
  status: BulkOperationStatus,
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  };

  if (status === "processing") {
    updateData.started_at = new Date().toISOString();
  } else if (status === "completed" || status === "failed") {
    updateData.completed_at = new Date().toISOString();
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from("bulk_operations")
    .update(updateData)
    .eq("id", operationId);

  if (error) throw error;
}

export async function updateBulkOperationItemStatus(
  itemId: string,
  status: "success" | "failed",
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const { error } = await supabase
    .from("bulk_operation_items")
    .update({
      status,
      error_message: errorMessage,
      processed_at: new Date().toISOString()
    })
    .eq("id", itemId);

  if (error) throw error;
}

export async function getBulkOperation(operationId: string): Promise<BulkOperation | null> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("bulk_operations")
    .select()
    .eq("id", operationId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  
  return data;
}

export async function getBulkOperations(params: {
  organizationId?: string;
  gymId?: string;
  createdBy?: string;
  limit?: number;
}): Promise<BulkOperation[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("bulk_operations")
    .select()
    .order("created_at", { ascending: false });

  if (params.organizationId) {
    query = query.eq("organization_id", params.organizationId);
  }
  if (params.gymId) {
    query = query.eq("gym_id", params.gymId);
  }
  if (params.createdBy) {
    query = query.eq("created_by", params.createdBy);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getBulkOperationItems(operationId: string): Promise<BulkOperationItem[]> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("bulk_operation_items")
    .select()
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function cancelBulkOperation(operationId: string): Promise<void> {
  await updateBulkOperationStatus(operationId, "cancelled");
}

// Bulk delete operation
export async function executeBulkDelete(params: {
  entityType: string;
  entityIds: string[];
  organizationId?: string;
  gymId?: string;
  createdBy: string;
}): Promise<BulkOperation> {
  const operation = await createBulkOperation({
    organizationId: params.organizationId,
    gymId: params.gymId,
    operationType: "delete",
    entityType: params.entityType,
    totalCount: params.entityIds.length,
    createdBy: params.createdBy
  });

  await addBulkOperationItems(operation.id, params.entityIds);
  await updateBulkOperationStatus(operation.id, "processing");

  // Execute deletion in background
  executeBulkDeleteAsync(operation.id, params.entityType, params.entityIds).catch(error => {
    console.error("Bulk delete failed:", error);
  });

  return operation;
}

async function executeBulkDeleteAsync(
  operationId: string,
  entityType: string,
  entityIds: string[]
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const items = await getBulkOperationItems(operationId);

  for (const item of items) {
    try {
      let error: any = null;

      switch (entityType) {
        case "members":
          const memberResult = await supabase
            .from("members")
            .delete()
            .eq("id", item.entity_id);
          error = memberResult.error;
          break;

        case "leads":
          const leadResult = await supabase
            .from("crm_leads")
            .delete()
            .eq("id", item.entity_id);
          error = leadResult.error;
          break;

        case "equipment":
          const equipResult = await supabase
            .from("equipment")
            .delete()
            .eq("id", item.entity_id);
          error = equipResult.error;
          break;

        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }

      if (error) {
        await updateBulkOperationItemStatus(item.id, "failed", error.message);
      } else {
        await updateBulkOperationItemStatus(item.id, "success");
      }
    } catch (error) {
      await updateBulkOperationItemStatus(
        item.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  await updateBulkOperationStatus(operationId, "completed");
}

// Bulk update operation
export async function executeBulkUpdate(params: {
  entityType: string;
  entityIds: string[];
  updates: Record<string, any>;
  organizationId?: string;
  gymId?: string;
  createdBy: string;
}): Promise<BulkOperation> {
  const operation = await createBulkOperation({
    organizationId: params.organizationId,
    gymId: params.gymId,
    operationType: "update",
    entityType: params.entityType,
    totalCount: params.entityIds.length,
    createdBy: params.createdBy,
    metadata: { updates: params.updates }
  });

  await addBulkOperationItems(operation.id, params.entityIds);
  await updateBulkOperationStatus(operation.id, "processing");

  // Execute update in background
  executeBulkUpdateAsync(operation.id, params.entityType, params.entityIds, params.updates).catch(error => {
    console.error("Bulk update failed:", error);
  });

  return operation;
}

async function executeBulkUpdateAsync(
  operationId: string,
  entityType: string,
  entityIds: string[],
  updates: Record<string, any>
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const items = await getBulkOperationItems(operationId);

  for (const item of items) {
    try {
      let error: any = null;

      switch (entityType) {
        case "members":
          const memberResult = await supabase
            .from("members")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", item.entity_id);
          error = memberResult.error;
          break;

        case "leads":
          const leadResult = await supabase
            .from("crm_leads")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", item.entity_id);
          error = leadResult.error;
          break;

        case "equipment":
          const equipResult = await supabase
            .from("equipment")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", item.entity_id);
          error = equipResult.error;
          break;

        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }

      if (error) {
        await updateBulkOperationItemStatus(item.id, "failed", error.message);
      } else {
        await updateBulkOperationItemStatus(item.id, "success");
      }
    } catch (error) {
      await updateBulkOperationItemStatus(
        item.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  await updateBulkOperationStatus(operationId, "completed");
}

// Bulk assign operation
export async function executeBulkAssign(params: {
  entityType: string;
  entityIds: string[];
  assignTo: string;
  organizationId?: string;
  gymId?: string;
  createdBy: string;
}): Promise<BulkOperation> {
  const operation = await createBulkOperation({
    organizationId: params.organizationId,
    gymId: params.gymId,
    operationType: "assign",
    entityType: params.entityType,
    totalCount: params.entityIds.length,
    createdBy: params.createdBy,
    metadata: { assignTo: params.assignTo }
  });

  await addBulkOperationItems(operation.id, params.entityIds);
  await updateBulkOperationStatus(operation.id, "processing");

  // Execute assignment in background
  executeBulkAssignAsync(operation.id, params.entityType, params.entityIds, params.assignTo).catch(error => {
    console.error("Bulk assign failed:", error);
  });

  return operation;
}

async function executeBulkAssignAsync(
  operationId: string,
  entityType: string,
  entityIds: string[],
  assignTo: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const items = await getBulkOperationItems(operationId);

  for (const item of items) {
    try {
      let error: any = null;

      switch (entityType) {
        case "leads":
          const leadResult = await supabase
            .from("crm_leads")
            .update({ 
              assigned_to: assignTo,
              updated_at: new Date().toISOString() 
            })
            .eq("id", item.entity_id);
          error = leadResult.error;
          break;

        case "support_tickets":
          const ticketResult = await supabase
            .from("support_tickets")
            .update({ 
              assigned_to: assignTo,
              updated_at: new Date().toISOString() 
            })
            .eq("id", item.entity_id);
          error = ticketResult.error;
          break;

        default:
          throw new Error(`Unknown entity type for assignment: ${entityType}`);
      }

      if (error) {
        await updateBulkOperationItemStatus(item.id, "failed", error.message);
      } else {
        await updateBulkOperationItemStatus(item.id, "success");
      }
    } catch (error) {
      await updateBulkOperationItemStatus(
        item.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  await updateBulkOperationStatus(operationId, "completed");
}
