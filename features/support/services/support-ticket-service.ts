import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TicketWithRelations, SupportTicketRow } from "@/types/enterprise";

import { db } from "./support-db";

export type TicketListOptions = {
  organizationId?: string;
  gymId?: string;
  branchId?: string;
  status?: string;
  priority?: string;
  categoryId?: string;
  assignedTo?: string;
  customerId?: string;
  slaBreached?: boolean;
  isEscalated?: boolean;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function listTickets(options: TicketListOptions = {}) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  let q = sdb.from("support_tickets").select("*, category:support_ticket_categories(*), assignedAgent:profiles!assigned_to(id, full_name, email), slaPolicy:support_sla_policies(*)", { count: "exact" });

  if (options.organizationId) q = q.eq("organization_id", options.organizationId);
  if (options.gymId) q = q.eq("gym_id", options.gymId);
  if (options.branchId) q = q.eq("branch_id", options.branchId);
  if (options.status) {
    const statuses = options.status.split(",");
    q = q.in("status", statuses);
  }
  if (options.priority) {
    const priorities = options.priority.split(",");
    q = q.in("priority", priorities);
  }
  if (options.categoryId) q = q.eq("category_id", options.categoryId);
  if (options.assignedTo) q = q.eq("assigned_to", options.assignedTo);
  if (options.customerId) q = q.eq("customer_id", options.customerId);
  if (options.slaBreached) q = q.eq("sla_breached", true);
  if (options.isEscalated) q = q.eq("is_escalated", true);
  if (options.search) {
    q = q.or(`subject.ilike.%${options.search}%,customer_name.ilike.%${options.search}%,ticket_number.ilike.%${options.search}%`);
  }
  if (options.dateFrom) q = q.gte("created_at", options.dateFrom);
  if (options.dateTo) q = q.lte("created_at", options.dateTo);

  const sortCol = options.sortBy ?? "created_at";
  const sortDir = options.sortOrder === "asc" ? { ascending: true } : { ascending: false };
  q = q.order(sortCol, sortDir).range(offset, offset + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { tickets: data as unknown as TicketWithRelations[], total: count ?? 0, page, pageSize };
}

export async function getTicketById(ticketId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: ticket, error } = await sdb
    .from("support_tickets")
    .select("*, category:support_ticket_categories(*), assignedAgent:profiles!assigned_to(id, full_name, email), slaPolicy:support_sla_policies(*)")
    .eq("id", ticketId)
    .single();
  if (error) throw new Error(error.message);
  if (!ticket) return null;

  const [messages, notes, timeline, attachments, feedback] = await Promise.all([
    sdb.from("support_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    sdb.from("support_ticket_notes").select("*, author:profiles!created_by(id, full_name)").eq("ticket_id", ticketId).order("created_at", { ascending: false }),
    sdb.from("support_ticket_timeline").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }),
    sdb.from("support_ticket_attachments").select("*").eq("ticket_id", ticketId),
    sdb.from("support_customer_feedback").select("*").eq("ticket_id", ticketId).maybeSingle(),
  ]);

  return {
    ...ticket,
    messages: messages.data ?? [],
    notes: notes.data ?? [],
    timeline: timeline.data ?? [],
    attachments: attachments.data ?? [],
    feedback: feedback.data ?? null,
  } as unknown as TicketWithRelations;
}

export async function createTicket(input: {
  organizationId: string;
  gymId?: string;
  branchId?: string;
  categoryId?: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerType?: string;
  membershipId?: string;
  subject: string;
  description: string;
  priority?: string;
  source?: string;
  createdBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb.from("support_tickets").insert({
    organization_id: input.organizationId,
    gym_id: input.gymId ?? null,
    branch_id: input.branchId ?? null,
    category_id: input.categoryId ?? null,
    customer_id: input.customerId ?? null,
    customer_name: input.customerName,
    customer_email: input.customerEmail ?? null,
    customer_phone: input.customerPhone ?? null,
    customer_type: input.customerType ?? "member",
    membership_id: input.membershipId ?? null,
    subject: input.subject,
    description: input.description,
    priority: input.priority ?? "medium",
    source: input.source ?? "manual",
    created_by: input.createdBy,
  }).select("*, category:support_ticket_categories(*)").single();
  if (error) throw new Error(error.message);
  return data as unknown as TicketWithRelations;
}

export async function updateTicket(ticketId: string, input: Partial<{
  status: string;
  priority: string;
  categoryId: string;
  assignedTo: string;
  subject: string;
  description: string;
  slaPolicyId: string;
  metadata: Record<string, unknown>;
}>) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const payload: Record<string, unknown> = {};
  if (input.status) payload.status = input.status;
  if (input.priority) payload.priority = input.priority;
  if (input.categoryId !== undefined) payload.category_id = input.categoryId;
  if (input.assignedTo !== undefined) payload.assigned_to = input.assignedTo;
  if (input.subject) payload.subject = input.subject;
  if (input.description) payload.description = input.description;
  if (input.slaPolicyId !== undefined) payload.sla_policy_id = input.slaPolicyId;
  if (input.metadata) payload.metadata = input.metadata;

  if (input.status === "resolved") payload.resolved_at = new Date().toISOString();
  if (input.status === "closed") payload.closed_at = new Date().toISOString();

  const { data, error } = await sdb.from("support_tickets").update(payload).eq("id", ticketId).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as SupportTicketRow;
}

export async function assignTicket(ticketId: string, assignedTo: string, assignmentType: string, assignedBy: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data: ticket } = await sdb.from("support_tickets").select("assigned_to").eq("id", ticketId).single();
  if (!ticket) throw new Error("Ticket not found");

  const { error: assignError } = await sdb.from("support_ticket_assignments").insert({
    ticket_id: ticketId,
    assigned_from: ticket.assigned_to,
    assigned_to: assignedTo,
    assignment_type: assignmentType,
    created_by: assignedBy,
  });
  if (assignError) throw new Error(assignError.message);

  const { error: updateError } = await sdb.from("support_tickets").update({ assigned_to: assignedTo }).eq("id", ticketId);
  if (updateError) throw new Error(updateError.message);
}

export async function addNote(ticketId: string, body: string, isInternal: boolean, mentions: string[], createdBy: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb.from("support_ticket_notes").insert({
    ticket_id: ticketId,
    body,
    is_internal: isInternal,
    mentions,
    created_by: createdBy,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addMessage(ticketId: string, input: {
  channel: string;
  direction: string;
  senderId?: string;
  senderName: string;
  senderEmail?: string;
  subject?: string;
  body: string;
  bodyHtml?: string;
  externalId?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    channel: input.channel,
    direction: input.direction,
    sender_id: input.senderId ?? null,
    sender_name: input.senderName,
    sender_email: input.senderEmail ?? null,
    subject: input.subject ?? null,
    body: input.body,
    body_html: input.bodyHtml ?? null,
    external_id: input.externalId ?? null,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function uploadAttachment(ticketId: string, input: {
  noteId?: string;
  messageId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  publicUrl?: string;
  uploadedBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb.from("support_ticket_attachments").insert({
    ticket_id: ticketId,
    note_id: input.noteId ?? null,
    message_id: input.messageId ?? null,
    file_name: input.fileName,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    storage_path: input.storagePath,
    public_url: input.publicUrl ?? null,
    uploaded_by: input.uploadedBy,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
