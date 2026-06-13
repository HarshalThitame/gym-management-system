import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getTicketById, updateTicket } from "@/features/support/services/support-ticket-service";

export const runtime = "nodejs";

const adminRoles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(adminRoles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const ticket = await getTicketById(id);
    if (!ticket) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Ticket not found." } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: ticket });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed to fetch ticket." } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(adminRoles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};
    if (body.status) updatePayload.status = body.status;
    if (body.priority) updatePayload.priority = body.priority;
    if (body.categoryId) updatePayload.categoryId = body.categoryId;
    if (body.assignedTo) updatePayload.assignedTo = body.assignedTo;
    await updateTicket(id, updatePayload as never);
    return NextResponse.json({ ok: true, message: "Ticket updated." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "UPDATE_ERROR", message: e instanceof Error ? e.message : "Failed to update ticket." } }, { status: 500 });
  }
}
