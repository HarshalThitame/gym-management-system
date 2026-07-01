"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { SupportTicketSchema, TicketMessageSchema } from "../schemas/support";

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}

export async function createTicketAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/support");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }

  const parsed = SupportTicketSchema.safeParse({
    subject: formData.get("subject"),
    description: formData.get("description"),
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerType: formData.get("customerType") ?? "member",
    priority: formData.get("priority") ?? "medium",
    status: formData.get("status") ?? "open",
    assignedTo: formData.get("assignedTo") ?? "",
    assignedTeam: formData.get("assignedTeam") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Generate ticket number
  const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;

  const payload = {
    organization_id: scope.organizationId,
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    ticket_number: ticketNumber,
    subject: parsed.data.subject,
    description: parsed.data.description,
    customer_name: parsed.data.customerName,
    customer_email: parsed.data.customerEmail || null,
    customer_phone: parsed.data.customerPhone || null,
    customer_type: parsed.data.customerType || "member",
    priority: parsed.data.priority || "medium",
    status: parsed.data.status || "open",
    assigned_to: parsed.data.assignedTo || null,
    assigned_team: parsed.data.assignedTeam || null,
    source: "admin_portal",
    created_by: scope.userId,
    metadata: {}
  } as any;

  const { data, error } = await supabase.from("support_tickets").insert(payload).select("id").maybeSingle();
  if (error) return { status: "error", message: error.message };

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "create", entityType: "support_tickets", entityId: data?.id ?? null, metadata: { ticketNumber } });
  revalidatePath("/admin/support");
  return { status: "success", message: "Support ticket created." };
}

export async function updateTicketStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/support");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }

  const ticketId = formData.get("ticketId");
  const status = formData.get("status");

  if (!ticketId || typeof ticketId !== "string") {
    return { status: "error", message: "Ticket ID is required." };
  }
  if (!status || typeof status !== "string") {
    return { status: "error", message: "Status is required." };
  }

  const supabase = await createSupabaseServerClient();
  const updatePayload: any = { status };

  if (status === "resolved") {
    updatePayload.resolved_at = new Date().toISOString();
  } else if (status === "closed") {
    updatePayload.closed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("support_tickets")
    .update(updatePayload)
    .eq("id", ticketId)
    .eq("organization_id", scope.organizationId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "update_status", entityType: "support_tickets", entityId: ticketId, metadata: { status } });
  revalidatePath("/admin/support");
  return { status: "success", message: "Ticket status updated." };
}

export async function addTicketMessageAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/support");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }

  const parsed = TicketMessageSchema.safeParse({
    ticketId: formData.get("ticketId"),
    message: formData.get("message"),
    isInternal: Boolean(formData.get("isInternal"))
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    ticket_id: parsed.data.ticketId,
    body: parsed.data.message,
    channel: "internal",
    direction: "outbound",
    sender_id: scope.userId,
    sender_name: "Staff",
    metadata: { is_internal: parsed.data.isInternal ?? false }
  } as any;

  const { error } = await supabase.from("support_ticket_messages").insert(payload);
  if (error) return { status: "error", message: error.message };

  // Update first_response_at if this is the first staff message
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("first_response_at")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();

  if (ticket && !ticket.first_response_at) {
    await supabase
      .from("support_tickets")
      .update({ first_response_at: new Date().toISOString() })
      .eq("id", parsed.data.ticketId);
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "add_message", entityType: "support_ticket_messages", entityId: null, metadata: { ticketId: parsed.data.ticketId } });
  revalidatePath("/admin/support");
  return { status: "success", message: "Message added." };
}

export async function assignTicketAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/support");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }

  const ticketId = formData.get("ticketId");
  const assignedTo = formData.get("assignedTo");

  if (!ticketId || typeof ticketId !== "string") {
    return { status: "error", message: "Ticket ID is required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ assigned_to: assignedTo?.toString() || null })
    .eq("id", ticketId)
    .eq("organization_id", scope.organizationId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "assign", entityType: "support_tickets", entityId: ticketId, metadata: { assignedTo: assignedTo?.toString() ?? null } });
  revalidatePath("/admin/support");
  return { status: "success", message: "Ticket assigned." };
}
