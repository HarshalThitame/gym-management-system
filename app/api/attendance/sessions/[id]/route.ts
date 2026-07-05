import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission("attendance", "read");
    if (!auth.ok) return auth.response;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { id } = await params;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("*, members(full_name, member_code, phone)")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Session not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission("attendance", "write");
    if (!auth.ok) return auth.response;

    const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;

    const supabase = createAdminClient();

    const { data: session, error: fetchError } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Session not found." } },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    const now = new Date().toISOString();
    const auditMeta: Record<string, unknown> = { session_id: id };

    if (body.action === "check_out") {
      if (session.status !== "inside") {
        return NextResponse.json(
          { ok: false, error: { code: "INVALID_STATE", message: "Session is not active." } },
          { status: 409 }
        );
      }
      updates.check_out_at = body.check_out_at || now;
      updates.check_out_source = "reception";
      updates.checked_out_by = auth.context.userId;
      updates.status = "checked_out";
      updates.duration_minutes = Math.round(
        (new Date(updates.check_out_at as string).getTime() - new Date(session.check_in_at).getTime()) / 60000
      );
      auditMeta.action = "check_out";
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }
    if (body.status && ["checked_out", "void"].includes(body.status as string)) {
      updates.status = body.status;
      if (body.status === "void" && !updates.check_out_at) {
        updates.check_out_at = now;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_UPDATES", message: "No valid fields to update." } },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("attendance_sessions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: { code: "UPDATE_FAILED", message: updateError.message } },
        { status: 500 }
      );
    }

    if (body.action === "check_out") {
      await supabase.from("attendance_logs").insert({
        gym_id: gymScope.gymId,
        attendance_session_id: id,
        member_id: session.member_id,
        action: "check_out",
        source: "reception",
        result: "success",
        reason_code: "manual_check_out",
        message: `Checked out by ${auth.context.userId}`,
        actor_id: auth.context.userId,
        occurred_at: now,
      });

      if (organizationId) {
        publishAttendanceEvent({
          type: "check_out",
          session_id: id,
          member_id: session.member_id,
          gym_id: gymScope.gymId,
          organization_id: organizationId,
          branch_id: session.branch_id ?? undefined,
        }).catch(() => {});
      }
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: auditMeta.action === "check_out" ? "attendance.check_out" : "attendance.update",
      entityType: "attendance_session",
      entityId: id,
      metadata: { ...auditMeta, updates },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
