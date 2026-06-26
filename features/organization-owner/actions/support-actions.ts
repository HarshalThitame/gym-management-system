"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess, entitlementSimpleCatch } from "@/features/entitlement";
import { getOrgOwnerContext } from "./action-utils";

type ActionState = { status: "idle" | "success" | "error"; message?: string };

export async function createTicketAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgOwnerContext("/organization/support");
  try {
    await requireOrgFeatureAccess(ctx.organizationId, "member_management");
    const supabase = await createSupabaseServerClient();
    const subject = formData.get("subject") as string;
    const description = formData.get("description") as string;
    const priority = (formData.get("priority") as string) || "normal";
    const category = formData.get("category") as string || null;

    if (!subject || !description) return { status: "error", message: "Subject and description are required." };

    const { error } = await supabase.from("activity_events").insert({
      organization_id: ctx.organizationId,
      actor_id: ctx.userId,
      event_type: `support_ticket:${subject.slice(0, 100)}`,
      entity_type: "support_ticket",
      entity_id: `ticket-${Date.now()}`,
      severity: priority as "info" | "notice" | "warning" | "critical",
      metadata: {
        subject, description, priority, category,
        ticket_status: "open",
        created_at: new Date().toISOString()
      } as never
    } as never);

    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_ticket", entityType: "support_ticket", entityId: null, metadata: { subject, priority } as never });
    revalidatePath("/organization/support");
    return { status: "success", message: "Support ticket created. Our team will respond shortly." };
  } catch (e) {
    return entitlementSimpleCatch(e, "Failed to create ticket.");
  }
}

export async function updateTicketStatusAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgOwnerContext("/organization/support");
  try {
    await requireOrgFeatureAccess(ctx.organizationId, "member_management");
    const supabase = await createSupabaseServerClient();
    const ticketId = formData.get("ticketId") as string;
    const status = formData.get("status") as string;
    const note = formData.get("note") as string || null;

    if (!ticketId || !status) return { status: "error", message: "Ticket ID and status required." };

    // Get existing ticket to update its metadata
    const { data: existing } = await supabase.from("activity_events").select("metadata").eq("id", ticketId).single();
    const metadata = (existing?.metadata as Record<string, unknown>) ?? {};
    metadata.ticket_status = status;
    if (note) metadata.last_note = note;
    metadata.updated_at = new Date().toISOString();

    const { error } = await supabase.from("activity_events").update({ severity: status === "critical" ? "critical" : "notice", metadata: metadata as never } as never).eq("id", ticketId).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: ctx.userId, action: `organization_owner.update_ticket_status`, entityType: "support_ticket", entityId: ticketId, metadata: { status, note } as never });
    revalidatePath("/organization/support");
    return { status: "success", message: `Ticket ${status}.` };
  } catch (e) {
    return entitlementSimpleCatch(e, "Failed to update ticket.");
  }
}

export async function closeTicketAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const fd = new FormData();
  fd.set("ticketId", formData.get("ticketId") as string);
  fd.set("status", "closed");
  const resolution = formData.get("resolution");
  if (resolution) fd.set("note", resolution as string);
  return updateTicketStatusAction(prevState, fd);
}
