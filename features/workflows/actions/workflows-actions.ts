"use server";

import { revalidatePath } from "next/cache";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflowStatus,
  getWorkflowRuns,
} from "../services/workflows-service";

export async function getWorkflowsAction() {
  const scope = await requireGymAdminScope("/admin/automation");
  return getWorkflows(scope.scopedOrganizationId ?? scope.organizationId);
}

export async function getWorkflowAction(id: string) {
  await requireGymAdminScope("/admin/automation");
  return getWorkflow(id);
}

export async function createWorkflowAction(formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/automation");
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const triggerType = formData.get("triggerType") as string;

  if (!name || !triggerType) return;

  try {
    await createWorkflow({
      organization_id: scope.scopedOrganizationId ?? scope.organizationId,
      name,
      description,
      trigger_type: triggerType as "event" | "schedule" | "webhook" | "manual",
      created_by: scope.userId,
      status: "draft",
    });
    await writeAuditLog({ actorId: scope.userId, action: "workflow.created", entityType: "workflow" });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/automation/workflows");
}

export async function updateWorkflowAction(id: string, formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/automation");
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  try {
    await updateWorkflow(id, { name, description } as Record<string, unknown>);
    await writeAuditLog({ actorId: scope.userId, action: "workflow.updated", entityType: "workflow", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/automation/workflows");
}

export async function deleteWorkflowAction(id: string): Promise<void> {
  const scope = await requireGymAdminScope("/admin/automation");

  try {
    await deleteWorkflow(id);
    await writeAuditLog({ actorId: scope.userId, action: "workflow.deleted", entityType: "workflow", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/automation/workflows");
}

export async function toggleWorkflowAction(id: string, status: "active" | "inactive"): Promise<void> {
  const scope = await requireGymAdminScope("/admin/automation");

  try {
    await toggleWorkflowStatus(id, status);
    await writeAuditLog({ actorId: scope.userId, action: `workflow.${status}`, entityType: "workflow", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/automation/workflows");
}

export async function getWorkflowRunsAction(workflowId: string) {
  await requireGymAdminScope("/admin/automation");
  return getWorkflowRuns(workflowId);
}
