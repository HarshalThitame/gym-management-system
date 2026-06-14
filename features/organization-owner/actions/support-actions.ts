"use server";

import { writeAuditLog } from "@/lib/audit";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { createSupportTicket } from "@/features/organization-owner/services/support-service";

export async function createTicketAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const context = await getOrgOwnerContext("/organization/support");
    const subject = formData.get("subject") as string;
    const description = formData.get("description") as string;
    if (!subject || !description) return { ...prevState, status: "error", message: "Subject and description are required." };

    const ticket = await createSupportTicket(context.organizationId, context.userId, subject, description, (formData.get("priority") as string) || "normal", formData.get("category") as string | null);

    await writeAuditLog({ actorId: context.userId, action: "organization_owner.create_ticket", entityType: "tenant_support_ticket", entityId: ticket.id });
    revalidateOrgModules(["/organization/support"]);
    return { ...prevState, status: "success", message: "Support ticket created." };
  } catch (error) {
    return { ...prevState, status: "error", message: error instanceof Error ? error.message : "Failed to create ticket." };
  }
}
