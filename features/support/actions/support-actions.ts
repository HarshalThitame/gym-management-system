"use server";

import type { Json } from "@/types/database";
import { requireRole } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTicket, updateTicket, assignTicket, addNote as addNoteService,
} from "../services/support-ticket-service";
import { createSlaPolicy } from "../services/support-sla-service";
import { createEscalationRule, escalateTicket } from "../services/support-escalation-service";
import { createKbArticle } from "../services/support-knowledge-base-service";
import {
  TicketSchema, TicketUpdateSchema, TicketNoteSchema, TicketAssignmentSchema,
  TicketEscalationSchema, SlaPolicySchema, EscalationRuleSchema, KbArticleSchema,
} from "../schemas/support-schemas";
import type { AuthActionState } from "@/features/auth/actions/action-state";

const adminRoles = ["super_admin"] as const;

function validationState(fieldErrors: Record<string, string[]>): AuthActionState {
  return { status: "error", message: "Validation failed.", fieldErrors };
}

function successState(message: string): AuthActionState {
  return { status: "success", message };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message };
}

export async function createTicketAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const parsed = TicketSchema.safeParse({
      organizationId: formData.get("organizationId"),
      gymId: formData.get("gymId") || undefined,
      branchId: formData.get("branchId") || undefined,
      categoryId: formData.get("categoryId") || undefined,
      customerId: formData.get("customerId") || undefined,
      customerName: formData.get("customerName"),
      customerEmail: formData.get("customerEmail") || undefined,
      customerPhone: formData.get("customerPhone") || undefined,
      customerType: formData.get("customerType") || undefined,
      membershipId: formData.get("membershipId") || undefined,
      subject: formData.get("subject"),
      description: formData.get("description"),
      priority: formData.get("priority") || undefined,
      source: formData.get("source") || undefined,
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    const ticket = await createTicket({ ...parsed.data, createdBy: ctx.userId ?? "" } as never);
    const ticketNumber = (ticket as unknown as Record<string, unknown>).ticket_number;
    await writeAuditLog({
      actorId: ctx.userId, action: "support.ticket.created", entityType: "support_ticket",
      entityId: ticket.id,
    });
    revalidatePath("/super-admin/support");
    return successState(`Ticket ${ticketNumber} created.`);
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to create ticket.");
  }
}

export async function updateTicketAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const rawTicketId = formData.get("ticketId");
    const ticketId = typeof rawTicketId === "string" ? rawTicketId : "";

    const parsed = TicketUpdateSchema.safeParse({
      status: formData.get("status") || undefined,
      priority: formData.get("priority") || undefined,
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    await updateTicket(ticketId, parsed.data as never);
    await writeAuditLog({
      actorId: ctx.userId, action: "support.ticket.updated", entityType: "support_ticket",
      entityId: ticketId,
    });
    revalidatePath("/super-admin/support");
    return successState("Ticket updated.");
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to update ticket.");
  }
}

export async function assignTicketAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const parsed = TicketAssignmentSchema.safeParse({
      assignedTo: formData.get("assignedTo"),
      assignmentType: formData.get("assignmentType") ?? "manual",
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    const rawTicketId = formData.get("ticketId");
    const ticketId = typeof rawTicketId === "string" ? rawTicketId : "";

    await assignTicket(ticketId, parsed.data.assignedTo, parsed.data.assignmentType, ctx.userId ?? "");
    await writeAuditLog({
      actorId: ctx.userId, action: "support.ticket.assigned", entityType: "support_ticket",
      entityId: ticketId,
    });
    revalidatePath("/super-admin/support");
    return successState("Ticket assigned.");
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to assign ticket.");
  }
}

export async function addNoteAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const rawTicketId = formData.get("ticketId");
    const ticketId = typeof rawTicketId === "string" ? rawTicketId : "";

    const parsed = TicketNoteSchema.safeParse({
      body: formData.get("body"),
      isInternal: formData.get("isInternal") === "true",
      mentions: [],
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    await addNoteService(ticketId, parsed.data.body, parsed.data.isInternal, parsed.data.mentions, ctx.userId ?? "");
    revalidatePath("/super-admin/support");
    return successState("Note added.");
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to add note.");
  }
}

export async function escalateTicketAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const parsed = TicketEscalationSchema.safeParse({
      escalatedTo: formData.get("escalatedTo"),
      reason: formData.get("reason"),
      triggeredBy: formData.get("triggeredBy") ?? "agent",
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    const rawTicketId = formData.get("ticketId");
    const ticketId = typeof rawTicketId === "string" ? rawTicketId : "";

    await escalateTicket(ticketId, parsed.data.escalatedTo, parsed.data.reason, parsed.data.triggeredBy, ctx.userId ?? "");
    await writeAuditLog({
      actorId: ctx.userId, action: "support.ticket.escalated", entityType: "support_ticket",
      entityId: ticketId,
    });
    revalidatePath("/super-admin/support");
    return successState("Ticket escalated.");
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to escalate ticket.");
  }
}

export async function createSlaPolicyAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const parsed = SlaPolicySchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      priority: formData.get("priority"),
      firstResponseMinutes: Number(formData.get("firstResponseMinutes")),
      resolutionMinutes: Number(formData.get("resolutionMinutes")),
      escalationMinutes: formData.get("escalationMinutes") ? Number(formData.get("escalationMinutes")) : undefined,
      reopenMinutes: formData.get("reopenMinutes") ? Number(formData.get("reopenMinutes")) : undefined,
      isDefault: formData.get("isDefault") === "true",
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    await createSlaPolicy({ ...parsed.data, createdBy: ctx.userId ?? "" } as never);
    revalidatePath("/super-admin/support/sla");
    return successState("SLA policy created.");
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to create SLA policy.");
  }
}

export async function createEscalationRuleAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    await requireRole(adminRoles, "/super-admin");
    const parsed = EscalationRuleSchema.safeParse({
      name: formData.get("name"),
      triggerOn: formData.get("triggerOn"),
      priorityFrom: formData.get("priorityFrom") || undefined,
      priorityTo: formData.get("priorityTo") || undefined,
      escalateAfterMinutes: formData.get("escalateAfterMinutes") ? Number(formData.get("escalateAfterMinutes")) : undefined,
      escalateFromLevel: Number(formData.get("escalateFromLevel")),
      escalateToLevel: Number(formData.get("escalateToLevel")),
      notifyRoles: formData.getAll("notifyRoles").filter((v): v is string => typeof v === "string"),
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    await createEscalationRule(parsed.data as never);
    revalidatePath("/super-admin/support");
    return successState("Escalation rule created.");
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to create escalation rule.");
  }
}

export async function bulkUpdateTicketsAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const rawIds = formData.get("ticketIds");
    const ticketIds = typeof rawIds === "string" ? JSON.parse(rawIds) as string[] : [];
    if (ticketIds.length === 0) return errorState("No tickets selected.");

    const payload: Record<string, unknown> = {};
    const status = formData.get("status");
    const priority = formData.get("priority");
    const assignedTo = formData.get("assignedTo");
    const tag = formData.get("tag");

    if (status) payload.status = status;
    if (priority) payload.priority = priority;
    if (assignedTo) payload.assigned_to = assignedTo;
    if (tag) payload.tag = tag;

    const supabase = await createSupabaseServerClient();

    const { error } = await (supabase
      .from("support_tickets")
      .update(payload as never)
      .in("id", ticketIds) as unknown as { error: Error | null });

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "support.ticket.bulk_update",
      entityType: "support_ticket",
      entityId: ticketIds.join(","),
    });

    revalidatePath("/super-admin/support");
    return successState(`${ticketIds.length} tickets updated.`);
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to bulk update tickets.");
  }
}

export async function createKbArticleAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _prevState;
  try {
    const ctx = await requireRole(adminRoles, "/super-admin");
    const parsed = KbArticleSchema.safeParse({
      title: formData.get("title"),
      body: formData.get("body"),
      categoryId: formData.get("categoryId") || undefined,
      articleType: formData.get("articleType") || undefined,
      audience: formData.getAll("audience").filter((v): v is string => typeof v === "string"),
      tags: formData.getAll("tags").filter((v): v is string => typeof v === "string"),
      status: formData.get("status") || undefined,
    });
    if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

    await createKbArticle({ ...parsed.data, authorId: ctx.userId ?? "" } as never);
    revalidatePath("/super-admin/support/knowledge-base");
    return successState("Article created.");
  } catch (e) {
    return errorState(e instanceof Error ? e.message : "Failed to create article.");
  }
}
