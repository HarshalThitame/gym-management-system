import { NextResponse } from "next/server";
import type { Json } from "@/types/database";
import { requireApiRole } from "@/lib/auth/api-guards";
import { listTickets, createTicket } from "@/features/support/services/support-ticket-service";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const adminRoles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(adminRoles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Only admins can view tickets.",
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const options: Record<string, unknown> = {};
  const orgId = url.searchParams.get("organizationId");
  if (orgId) options.organizationId = orgId;
  const g = url.searchParams.get("gymId");
  if (g) options.gymId = g;
  const b = url.searchParams.get("branchId");
  if (b) options.branchId = b;
  const s = url.searchParams.get("status");
  if (s) options.status = s;
  const p = url.searchParams.get("priority");
  if (p) options.priority = p;
  const cat = url.searchParams.get("categoryId");
  if (cat) options.categoryId = cat;
  const assigned = url.searchParams.get("assignedTo");
  if (assigned) options.assignedTo = assigned;
  const cust = url.searchParams.get("customerId");
  if (cust) options.customerId = cust;
  if (url.searchParams.get("slaBreached") === "true") options.slaBreached = true;
  if (url.searchParams.get("isEscalated") === "true") options.isEscalated = true;
  const search = url.searchParams.get("search");
  if (search) options.search = search;
  const df = url.searchParams.get("dateFrom");
  if (df) options.dateFrom = df;
  const dt = url.searchParams.get("dateTo");
  if (dt) options.dateTo = dt;
  options.sortBy = url.searchParams.get("sortBy") ?? "created_at";
  options.sortOrder = url.searchParams.get("sortOrder") ?? "desc";
  options.page = Number(url.searchParams.get("page") ?? "1");
  options.pageSize = Number(url.searchParams.get("pageSize") ?? "25");

  try {
    const result = await listTickets(options);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed to fetch tickets." } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(adminRoles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Only admins can create tickets.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const createPayload: Record<string, unknown> = {
      organizationId: body.organizationId,
      customerName: body.customerName,
      subject: body.subject,
      description: body.description,
      createdBy: auth.context.userId,
    };
    if (body.gymId) createPayload.gymId = body.gymId;
    if (body.branchId) createPayload.branchId = body.branchId;
    if (body.categoryId) createPayload.categoryId = body.categoryId;
    if (body.customerId) createPayload.customerId = body.customerId;
    if (body.customerEmail) createPayload.customerEmail = body.customerEmail;
    if (body.customerPhone) createPayload.customerPhone = body.customerPhone;
    if (body.customerType) createPayload.customerType = body.customerType;
    if (body.membershipId) createPayload.membershipId = body.membershipId;
    if (body.priority) createPayload.priority = body.priority;
    if (body.source) createPayload.source = body.source;
    const ticket = await createTicket(createPayload as never);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "support.ticket.api_created" as const,
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: { ticketNumber: (ticket as Record<string, unknown>).ticket_number as string } as Json,
    });

    return NextResponse.json({ ok: true, data: ticket }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "CREATE_ERROR", message: e instanceof Error ? e.message : "Failed to create ticket." } }, { status: 500 });
  }
}
