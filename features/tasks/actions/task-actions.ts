"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { assertTaskTransition, requireScopedTask, toOperationErrorMessage } from "@/features/reception/lib/operation-guards";
import { TaskSchema, CompleteTaskSchema } from "../schemas/task-schemas";

function validationState(fieldErrors: Record<string, string[]>): AuthActionState {
  return { status: "error", message: "Validation failed.", fieldErrors };
}

function successState(message: string): AuthActionState {
  return { status: "success", message, success: true };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message, success: false };
}

export async function saveTaskAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/tasks");

  const parsed = TaskSchema.safeParse({
    taskId: formData.get("taskId") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    priority: formData.get("priority") ?? "medium",
    type: formData.get("type") ?? "general",
    dueDate: formData.get("dueDate") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const isUpdate = !!parsed.data.taskId;
  let currentTask = null;
  try {
    currentTask = isUpdate ? await requireScopedTask(supabase, parsed.data.taskId, scope) : null;
    if (currentTask) {
      assertTaskTransition(currentTask.status, currentTask.status);
    }
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this task."));
  }

  const payload = {
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    organization_id: scope.scopedOrganizationId ?? scope.organizationId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    type: parsed.data.type,
    due_date: parsed.data.dueDate || null,
    notes: parsed.data.notes || null,
    updated_at: new Date().toISOString()
  };

  const result = isUpdate
    ? await supabase
        .from("tasks")
        .update(payload)
        .eq("id", parsed.data.taskId)
        .eq("gym_id", scope.gymId)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("tasks")
        .insert({
          ...payload,
          created_by: scope.userId,
          assigned_to: scope.userId,
          status: "pending"
        })
        .select("*")
        .maybeSingle();

  if (result.error) return errorState(result.error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: isUpdate ? "task.update" : "task.create",
    entityType: "task",
    entityId: result.data?.id ?? parsed.data.taskId ?? "",
    metadata: { title: parsed.data.title, priority: parsed.data.priority }
  });

  revalidatePath("/reception/tasks");
  return successState(isUpdate ? "Task updated." : "Task created.");
}

export async function completeTaskAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/tasks");

  const parsed = CompleteTaskSchema.safeParse({
    taskId: formData.get("taskId") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  let task;
  try {
    task = await requireScopedTask(supabase, parsed.data.taskId, scope);
    assertTaskTransition(task.status, "completed");
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to complete this task."));
  }
  const updatePayload: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (parsed.data.notes) {
    updatePayload.notes = parsed.data.notes;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", parsed.data.taskId)
    .eq("gym_id", scope.gymId);

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "task.complete",
    entityType: "task",
    entityId: parsed.data.taskId,
    metadata: { previousStatus: task.status }
  });

  revalidatePath("/reception/tasks");
  return successState("Task completed.");
}

export async function startTaskAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/tasks");
  const taskId = formData.get("taskId") as string;

  if (!taskId) return errorState("Task ID required.");

  const supabase = await createSupabaseServerClient();
  let task;
  try {
    task = await requireScopedTask(supabase, taskId, scope);
    assertTaskTransition(task.status, "in_progress");
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to start this task."));
  }
  const { error } = await supabase
    .from("tasks")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("gym_id", scope.gymId);

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "task.start",
    entityType: "task",
    entityId: taskId,
    metadata: { previousStatus: task.status }
  });

  revalidatePath("/reception/tasks");
  return successState("Task started.");
}
