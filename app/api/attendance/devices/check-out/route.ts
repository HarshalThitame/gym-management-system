import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDeviceRequest } from "@/lib/security/device-auth";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";
import { writeAuditLog } from "@/lib/audit";
import { resolveDeviceBranchPolicy } from "@/features/attendance/lib/device-branch-policy";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateDeviceRequest(request);
    if (!auth.ok) return auth.response;

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const gymId = auth.device.gym_id;
    if (!gymId) {
      return NextResponse.json(
        { ok: false, error: { code: "DEVICE_NOT_ASSIGNED", message: "Device must be assigned to a gym." } },
        { status: 400 }
      );
    }

    const body = await request.json() as Record<string, unknown>;
    const { device_user_id, member_id, session_id } = body;

    let targetSessionId = session_id as string | undefined;
    let resolvedBranchId = auth.device.branch_id ?? null;

    // Resolve member if only device_user_id provided
    let resolvedMemberId = member_id as string | undefined;

    if (!resolvedMemberId && device_user_id) {
      const { data: mapping } = await supabase
        .from("member_device_mappings")
        .select("member_id")
        .eq("device_id", auth.device.id)
        .eq("device_user_id", device_user_id as string)
        .eq("is_active", true)
        .maybeSingle();

      if (mapping) resolvedMemberId = mapping.member_id;
    }

    // Find active session if not provided
    if (!targetSessionId && resolvedMemberId) {
      const { data: sessions, error: sessionQueryError } = await supabase
        .from("attendance_sessions")
        .select("id, branch_id, check_in_at")
        .eq("member_id", resolvedMemberId)
        .eq("gym_id", gymId)
        .eq("status", "inside")
        .order("check_in_at", { ascending: false })
        .limit(2);

      if (sessionQueryError) {
        return NextResponse.json(
          { ok: false, error: { code: "QUERY_FAILED", message: sessionQueryError.message } },
          { status: 500 }
        );
      }

      if ((sessions ?? []).length > 1) {
        await supabase.from("device_event_logs").insert({
          device_id: auth.device.id,
          gym_id: gymId,
          branch_id: auth.device.branch_id,
          event_type: "error",
          payload: {
            error: "duplicate_session_conflict",
            member_id: resolvedMemberId,
            active_session_ids: (sessions ?? []).map((session) => session.id),
          },
          occurred_at: now,
        });

        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "DUPLICATE_SESSION_CONFLICT",
              message: "Multiple active sessions are already open for this member. Manual checkout is required.",
            },
          },
          { status: 409 }
        );
      }

      const session = sessions?.[0];
      if (session) {
        targetSessionId = session.id;
        resolvedBranchId = session.branch_id ?? resolvedBranchId;
      }
    }

    if (!targetSessionId) {
      await supabase.from("device_event_logs").insert({
        device_id: auth.device.id,
        gym_id: gymId,
        branch_id: auth.device.branch_id,
        event_type: "error",
        payload: { error: "no_active_session", member_id: resolvedMemberId ?? null },
        occurred_at: now,
      });

      return NextResponse.json(
        { ok: false, error: { code: "NO_ACTIVE_SESSION", message: "No active session found for check-out." } },
        { status: 404 }
      );
    }

    // Verify session belongs to this gym
    const { data: session, error: fetchError } = await supabase
      .from("attendance_sessions")
      .select("id, member_id, check_in_at, branch_id")
      .eq("id", targetSessionId)
      .eq("gym_id", gymId)
      .eq("status", "inside")
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { ok: false, error: { code: "SESSION_NOT_FOUND", message: "Active session not found." } },
        { status: 404 }
      );
    }

    const branchPolicy = await resolveDeviceBranchPolicy({
      gymId,
      deviceBranchId: auth.device.branch_id,
      memberBranchId: session.branch_id,
      actorBranchId: null,
      persistMemberBranch: false,
    });

    if (!branchPolicy.ok) {
      await supabase.from("device_event_logs").insert({
        device_id: auth.device.id,
        gym_id: gymId,
        branch_id: auth.device.branch_id,
        event_type: "error",
        payload: {
          error: "branch_scope_denied",
          session_id: targetSessionId,
          session_branch_id: session.branch_id,
          device_branch_id: auth.device.branch_id,
          code: branchPolicy.code,
        },
        occurred_at: now,
      });

      return NextResponse.json(
        { ok: false, error: { code: branchPolicy.code, message: branchPolicy.message } },
        { status: 403 }
      );
    }

    resolvedBranchId = branchPolicy.branchId;

    const checkOutAt = now;
    const durationMinutes = Math.round(
      (new Date(checkOutAt).getTime() - new Date(session.check_in_at).getTime()) / 60000
    );

    const { data: updated, error: updateError } = await supabase
      .from("attendance_sessions")
      .update({
        check_out_at: checkOutAt,
        check_out_source: "device",
        status: "checked_out",
        duration_minutes: durationMinutes,
      })
      .eq("id", targetSessionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: { code: "UPDATE_FAILED", message: updateError.message } },
        { status: 500 }
      );
    }

    // Log event
    await supabase.from("device_event_logs").insert({
      device_id: auth.device.id,
      gym_id: gymId,
      branch_id: resolvedBranchId,
      event_type: "check_out",
      payload: {
        session_id: targetSessionId,
        member_id: session.member_id,
        duration_minutes: durationMinutes,
        branch_source: branchPolicy.branchSource,
      },
      occurred_at: now,
    });

    // Attendance log
    await supabase.from("attendance_logs").insert({
      gym_id: gymId,
      attendance_session_id: targetSessionId,
      member_id: session.member_id,
      action: "check_out",
      source: "device",
      result: "success",
      reason_code: "device_check_out",
      message: `Device check-out via ${auth.device.device_name}`,
      actor_id: null,
      occurred_at: now,
    });

    const eventPayload = {
      type: "check_out" as const,
      session_id: targetSessionId,
      member_id: session.member_id,
      gym_id: gymId,
      organization_id: auth.device.organization_id,
      branch_id: resolvedBranchId ?? undefined,
    };
    publishAttendanceEvent(eventPayload).catch(() => {});

    writeAuditLog({
      actorId: "device:" + auth.device.id,
      gymId: gymId,
      action: "attendance.check_out",
      entityType: "member",
      entityId: session.member_id,
      metadata: { session_id: targetSessionId, device_id: auth.device.id, duration_minutes: durationMinutes },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      data: {
        session_id: targetSessionId,
        check_in_at: session.check_in_at,
        check_out_at: updated.check_out_at,
        duration_minutes: durationMinutes,
        status: "checked_out",
        member_id: session.member_id,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
