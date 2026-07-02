"use server";

import { revalidatePath } from "next/cache";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  getAutomationRules,
  getAutomationRule,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  getAutomationLogs,
} from "../services/automation-service";

export async function getAutomationRulesAction() {
  const scope = await requireGymAdminScope("/admin/automation");
  return getAutomationRules(scope.scopedOrganizationId ?? scope.organizationId);
}

export async function getAutomationRuleAction(id: string) {
  await requireGymAdminScope("/admin/automation");
  return getAutomationRule(id);
}

export async function createAutomationRuleAction(formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/automation");
  const name = formData.get("name") as string;
  const eventType = formData.get("eventType") as string;
  const actionsRaw = formData.get("actions") as string;

  if (!name || !eventType) return;

  try {
    await createAutomationRule({
      organization_id: scope.scopedOrganizationId ?? scope.organizationId,
      name,
      event_type: eventType,
      actions: actionsRaw ? JSON.parse(actionsRaw) : [],
      created_by: scope.userId,
    });
    await writeAuditLog({ actorId: scope.userId, action: "automation_rule.created", entityType: "automation_rule" });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/automation/triggers");
}

export async function updateAutomationRuleAction(id: string, formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/automation");
  const name = formData.get("name") as string;
  const status = formData.get("status") as string;

  try {
    await updateAutomationRule(id, { name, status } as Record<string, unknown>);
    await writeAuditLog({ actorId: scope.userId, action: "automation_rule.updated", entityType: "automation_rule", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/automation/triggers");
}

export async function deleteAutomationRuleAction(id: string): Promise<void> {
  const scope = await requireGymAdminScope("/admin/automation");

  try {
    await deleteAutomationRule(id);
    await writeAuditLog({ actorId: scope.userId, action: "automation_rule.deleted", entityType: "automation_rule", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/automation/triggers");
}

export async function getAutomationLogsAction(ruleId: string) {
  await requireGymAdminScope("/admin/automation");
  return getAutomationLogs(ruleId);
}
