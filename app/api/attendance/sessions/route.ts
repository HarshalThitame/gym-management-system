import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiPermission("attendance", "read");
    if (!auth.ok) return auth.response;

    const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: { code: "ORG_SCOPE_REQUIRED", message: "Organization scope required." } },
        { status: 403 }
      );
    }

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), 100);
    const offset = (page - 1) * limit;

    const memberId = searchParams.get("member_id");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const branchId = searchParams.get("branch_id");

    const supabase = createAdminClient();

    let query = supabase
      .from("attendance_sessions")
      .select("*, members(full_name, member_code, phone)", { count: "exact" })
      .eq("gym_id", gymScope.gymId)
      .order("check_in_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (memberId) query = query.eq("member_id", memberId);
    if (status) query = query.eq("status", status);
    if (branchId) query = query.eq("branch_id", branchId);
    if (dateFrom) query = query.gte("check_in_at", dateFrom);
    if (dateTo) query = query.lte("check_in_at", dateTo);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        items: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiPermission("attendance", "write");
    if (!auth.ok) return auth.response;

    const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: { code: "ORG_SCOPE_REQUIRED", message: "Organization scope required." } },
        { status: 403 }
      );
    }

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const body = await request.json();
    const { member_id, branch_id, notes } = body as Record<string, unknown>;

    if (!member_id || typeof member_id !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "member_id is required" } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, full_name, membership_status")
      .eq("id", member_id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Member not found in this gym." } },
        { status: 404 }
      );
    }

    if (member.membership_status !== "active") {
      return NextResponse.json(
        { ok: false, error: { code: "MEMBERSHIP_INACTIVE", message: "Member does not have an active membership." } },
        { status: 403 }
      );
    }

    const { data: activeSession } = await supabase
      .from("attendance_sessions")
      .select("id, check_in_at")
      .eq("member_id", member_id)
      .eq("gym_id", gymScope.gymId)
      .eq("status", "inside")
      .maybeSingle();

    if (activeSession) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "DUPLICATE_CHECK_IN", message: "Member is already checked in." },
          data: { session_id: activeSession.id, checked_in_at: activeSession.check_in_at },
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { data: session, error: insertError } = await supabase
      .from("attendance_sessions")
      .insert({
        gym_id: gymScope.gymId,
        member_id,
        branch_id: (branch_id as string) || null,
        check_in_at: now,
        check_in_source: "reception",
        status: "inside",
        created_by: auth.context.userId,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: { code: "INSERT_FAILED", message: insertError.message } },
        { status: 500 }
      );
    }

    await supabase.from("attendance_logs").insert({
      gym_id: gymScope.gymId,
      attendance_session_id: session.id,
      member_id,
      action: "check_in",
      source: "reception",
      result: "success",
      reason_code: "manual_check_in",
      message: `Manual check-in by ${auth.context.userId}`,
      actor_id: auth.context.userId,
      occurred_at: now,
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: "attendance.check_in",
      entityType: "member",
      entityId: member_id,
      metadata: { session_id: session.id },
    });

    if (organizationId) {
      publishAttendanceEvent({
        type: "check_in",
        session_id: session.id,
        member_id,
        gym_id: gymScope.gymId,
        organization_id: organizationId,
        branch_id: (branch_id as string) || undefined,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, data: session }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
