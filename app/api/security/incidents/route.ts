import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { listIncidents, getIncidentDetail, updateIncidentStatus, assignIncident, addInvestigationNote } from "@/features/security/services/security-incident-service";

const roles = ["super_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("id");
    if (eventId) {
      const detail = await getIncidentDetail(eventId);
      return NextResponse.json({ ok: true, data: detail });
    }
    const opts: Record<string, unknown> = { page: Number(url.searchParams.get("page") ?? "1"), pageSize: Number(url.searchParams.get("pageSize") ?? "25") };
    const status = url.searchParams.get("status"); if (status) opts.status = status;
    const severity = url.searchParams.get("severity"); if (severity) opts.severity = severity;
    const { incidents, total, page, pageSize } = await listIncidents(opts as never);
    return NextResponse.json({ ok: true, data: { incidents, total, page, pageSize } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "update_status") {
      await updateIncidentStatus(body.eventId as string, body.status as string, body.note as string, auth.context.userId ?? "");
      return NextResponse.json({ ok: true, message: "Status updated." });
    }
    if (body.action === "assign") {
      await assignIncident(body.eventId as string, body.assignedTo as string, auth.context.userId ?? "");
      return NextResponse.json({ ok: true, message: "Assigned." });
    }
    if (body.action === "add_note") {
      await addInvestigationNote(body.eventId as string, body.note as string, auth.context.userId ?? "");
      return NextResponse.json({ ok: true, message: "Note added." });
    }
    return NextResponse.json({ ok: false, error: { code: "INVALID_ACTION", message: "Invalid action." } }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}
