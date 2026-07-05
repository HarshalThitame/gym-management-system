import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDeviceRequest } from "@/lib/security/device-auth";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";
import { writeAuditLog } from "@/lib/audit";
import { validateMembershipForAccess } from "@/features/attendance/lib/business-rules";
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
    const { device_user_id, member_id, confidence } = body;

    if (!device_user_id && !member_id) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "device_user_id or member_id is required." } },
        { status: 400 }
      );
    }

    // Update device last seen
    await supabase
      .from("attendance_devices")
      .update({ last_seen_at: now, status: "online" })
      .eq("id", auth.device.id);

    // Resolve member
    let resolvedMemberId = member_id as string | undefined;
    let mappingId: string | undefined;

    if (!resolvedMemberId && device_user_id) {
      const { data: mapping } = await supabase
        .from("member_device_mappings")
        .select("member_id, id")
        .eq("device_id", auth.device.id)
        .eq("device_user_id", device_user_id as string)
        .eq("is_active", true)
        .maybeSingle();

      if (mapping) {
        resolvedMemberId = mapping.member_id;
        mappingId = mapping.id;
      }
    }

    if (!resolvedMemberId) {
      await supabase.from("device_event_logs").insert({
        device_id: auth.device.id,
        gym_id: gymId,
        branch_id: auth.device.branch_id,
        event_type: "error",
        payload: {
          error: "member_not_found",
          device_user_id: device_user_id ?? null,
          member_id: member_id ?? null,
        },
        occurred_at: now,
      });

      return NextResponse.json(
        { ok: false, error: { code: "MEMBER_NOT_FOUND", message: "No matching member found for this device user." } },
        { status: 404 }
      );
    }

    const { data: memberRow } = await supabase
      .from("members")
      .select("id, branch_id, full_name, member_code")
      .eq("id", resolvedMemberId)
      .eq("gym_id", gymId)
      .maybeSingle();

    if (!memberRow) {
      return NextResponse.json(
        { ok: false, error: { code: "MEMBER_NOT_FOUND", message: "Member not found in this gym." } },
        { status: 404 }
      );
    }

    const branchPolicy = await resolveDeviceBranchPolicy({
      gymId,
      deviceBranchId: auth.device.branch_id,
      memberBranchId: memberRow.branch_id,
      actorBranchId: null,
    });

    if (!branchPolicy.ok) {
      await supabase.from("device_event_logs").insert({
        device_id: auth.device.id,
        gym_id: gymId,
        branch_id: auth.device.branch_id,
        event_type: "error",
        payload: {
          error: "branch_scope_denied",
          member_id: resolvedMemberId,
          member_branch_id: memberRow.branch_id,
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

    if (branchPolicy.shouldPersistMemberBranch) {
      await supabase.from("members").update({ branch_id: branchPolicy.branchId }).eq("id", resolvedMemberId);
      memberRow.branch_id = branchPolicy.branchId;
    }

    // Validate membership
    const { data: membership } = await supabase
      .from("memberships")
      .select("*, membership_plans!inner(plan_name)")
      .eq("member_id", resolvedMemberId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membership) {
      const accessCheck = validateMembershipForAccess(membership, new Date());
      if (!accessCheck.allowed) {
        await supabase.from("device_event_logs").insert({
          device_id: auth.device.id,
          gym_id: gymId,
          branch_id: auth.device.branch_id,
          event_type: "error",
          payload: {
            error: "access_denied",
            member_id: resolvedMemberId,
            reason: accessCheck.reasonCode,
            message: accessCheck.message,
          },
          occurred_at: now,
        });

        return NextResponse.json(
          { ok: false, error: { code: "ACCESS_DENIED", message: accessCheck.message } },
          { status: 403 }
        );
      }
    }

    // Check for duplicate check-in
    const { data: activeSessions, error: activeSessionsError } = await supabase
      .from("attendance_sessions")
      .select("id, check_in_at, branch_id")
      .eq("member_id", resolvedMemberId)
      .eq("gym_id", gymId)
      .eq("status", "inside")
      .order("check_in_at", { ascending: false })
      .limit(2);

    if (activeSessionsError) {
      return NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED", message: activeSessionsError.message } },
        { status: 500 }
      );
    }

    if ((activeSessions ?? []).length > 1) {
      await supabase.from("device_event_logs").insert({
        device_id: auth.device.id,
        gym_id: gymId,
        branch_id: branchPolicy.branchId,
        event_type: "error",
        payload: {
          error: "duplicate_session_conflict",
          member_id: resolvedMemberId,
          active_session_ids: (activeSessions ?? []).map((session) => session.id),
        },
        occurred_at: now,
      });
      await supabase.from("attendance_logs").insert({
        gym_id: gymId,
        attendance_session_id: (activeSessions ?? [])[0]?.id ?? null,
        member_id: resolvedMemberId,
        action: "duplicate_attempt",
        source: "device",
        result: "warning",
        reason_code: "duplicate_check_in",
        message: "Multiple active sessions detected.",
        actor_id: null,
        device_id: auth.device.id,
        metadata: {
          activeSessionIds: (activeSessions ?? []).map((session) => session.id),
        },
        occurred_at: now,
      });

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "DUPLICATE_SESSION_CONFLICT",
            message: "Multiple active sessions are already open for this member. Manual review required.",
          },
        },
        { status: 409 }
      );
    }

    const activeSession = activeSessions?.[0] ?? null;

    if (activeSession) {
      await supabase.from("device_event_logs").insert({
        device_id: auth.device.id,
        gym_id: gymId,
        branch_id: branchPolicy.branchId,
        event_type: "check_in",
        payload: {
          session_id: activeSession.id,
          member_id: resolvedMemberId,
          device_user_id: device_user_id ?? null,
          confidence: confidence ?? null,
          mapping_id: mappingId ?? null,
          duplicate: true,
        },
        occurred_at: now,
      });
      await supabase.from("attendance_logs").insert({
        gym_id: gymId,
        attendance_session_id: activeSession.id,
        member_id: resolvedMemberId,
        action: "duplicate_attempt",
        source: "device",
        result: "warning",
        reason_code: "duplicate_check_in",
        message: "Member is already checked in.",
        actor_id: null,
        device_id: auth.device.id,
        metadata: {
          existingSessionId: activeSession.id,
          branchId: branchPolicy.branchId,
        },
        occurred_at: now,
      });
      // Already checked in — this is valid, return the existing session
      return NextResponse.json({
        ok: true,
        data: {
          session_id: activeSession.id,
          check_in_at: activeSession.check_in_at,
          status: "already_inside",
          member_id: resolvedMemberId,
        },
      });
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .insert({
        gym_id: gymId,
        member_id: resolvedMemberId,
        branch_id: branchPolicy.branchId,
        check_in_at: now,
        check_in_source: "device",
        status: "inside",
        created_by: null,
      })
      .select()
      .single();

    if (sessionError) {
      return NextResponse.json(
        { ok: false, error: { code: "SESSION_CREATE_FAILED", message: sessionError.message } },
        { status: 500 }
      );
    }

    // Log event
    await supabase.from("device_event_logs").insert({
      device_id: auth.device.id,
      gym_id: gymId,
      branch_id: branchPolicy.branchId,
      event_type: "check_in",
      payload: {
        session_id: session.id,
        member_id: resolvedMemberId,
        device_user_id: device_user_id ?? null,
        confidence: confidence ?? null,
        mapping_id: mappingId ?? null,
        branch_source: branchPolicy.branchSource,
      },
      occurred_at: now,
    });

    // Attendance log
    await supabase.from("attendance_logs").insert({
      gym_id: gymId,
      attendance_session_id: session.id,
      member_id: resolvedMemberId,
      action: "check_in",
      source: "device",
      result: "success",
      reason_code: "device_check_in",
      message: `Device check-in via ${auth.device.device_name}`,
      actor_id: null,
      occurred_at: now,
    });

    // Real-time event
    publishAttendanceEvent({
      type: "check_in",
      session_id: session.id,
      member_id: resolvedMemberId,
      gym_id: gymId,
      organization_id: auth.device.organization_id,
      branch_id: branchPolicy.branchId ?? undefined,
    }).catch(() => {});

    writeAuditLog({
      actorId: "device:" + auth.device.id,
      gymId: gymId,
      action: "attendance.check_in",
      entityType: "member",
      entityId: resolvedMemberId,
      metadata: { session_id: session.id, device_id: auth.device.id, device_name: auth.device.device_name },
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: true,
        data: {
          session_id: session.id,
          check_in_at: session.check_in_at,
          status: "checked_in",
          member_id: resolvedMemberId,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
