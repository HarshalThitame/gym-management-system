import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";
import { writeAuditLog } from "@/lib/audit";
import {
  evaluateBranchGeofence,
  evaluateGeofenceExitDecision
} from "@/features/attendance/lib/geofence";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiPermission("attendance", "write");
    if (!auth.ok) return auth.response;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const memberId = typeof body.memberId === "string" ? body.memberId : typeof body.member_id === "string" ? body.member_id : null;
    const latitude = Number(body.latitude ?? body.lat);
    const longitude = Number(body.longitude ?? body.lng);
    const accuracyM = body.accuracyM ?? body.accuracy_m;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : typeof body.session_id === "string" ? body.session_id : null;

    if (!memberId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "memberId, latitude, and longitude are required." } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: member } = await supabase
      .from("members")
      .select("id, full_name, branch_id, gym_id")
      .eq("id", memberId)
      .eq("gym_id", gymScope.gymId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { ok: false, error: { code: "MEMBER_NOT_FOUND", message: "Member not found in this gym." } },
        { status: 404 }
      );
    }

    const resolvedBranchId = member.branch_id ?? gymScope.branchId ?? null;
    if (!resolvedBranchId) {
      return NextResponse.json(
        { ok: false, error: { code: "BRANCH_SCOPE_REQUIRED", message: "Member or branch scope is required." } },
        { status: 403 }
      );
    }

    const evaluation = await evaluateBranchGeofence(resolvedBranchId, { latitude, longitude });
    const occurredAt = new Date().toISOString();

    const { data: session } = await supabase
      .from("attendance_sessions")
      .select("id, status, check_in_at")
      .eq("member_id", memberId)
      .eq("gym_id", gymScope.gymId)
      .eq("status", "inside")
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: settingsRow } = await supabase
      .from("branch_settings")
      .select("attendance_settings")
      .eq("branch_id", resolvedBranchId)
      .maybeSingle();

    const { data: recentLocationEvents } = session?.id
      ? await supabase
          .from("attendance_location_events")
          .select("id, inside_geofence, occurred_at, accuracy_m, metadata")
          .eq("attendance_session_id", session.id)
          .order("occurred_at", { ascending: false })
          .limit(10)
      : { data: [], error: null };

    const decision = evaluateGeofenceExitDecision({
      settings: settingsRow?.attendance_settings ?? {},
      evaluation,
      accuracyM: Number.isFinite(Number(accuracyM)) ? Number(accuracyM) : null,
      occurredAt,
      recentEvents: Array.isArray(recentLocationEvents) ? recentLocationEvents : [],
      hasActiveSession: Boolean(session?.id)
    });

    const responseSessionActive = Boolean(session?.id) && !decision.shouldAutoCheckout;
    const eventMetadata = {
      branchName: evaluation.branchName,
      distanceMeters: evaluation.distanceMeters,
      evaluatedAt: occurredAt,
      geofenceDecision: decision.status,
      geofenceReasonCode: decision.reasonCode,
      consecutiveOutsideSamples: decision.consecutiveOutsideSamples,
      outsideSampleThreshold: decision.outsideSampleThreshold,
      minimumAccuracyMeters: decision.minimumAccuracyMeters,
      graceWindowSeconds: decision.graceWindowSeconds
    };

    if (session?.id) {
      await supabase.from("attendance_location_events").insert({
        gym_id: gymScope.gymId,
        branch_id: resolvedBranchId,
        member_id: memberId,
        attendance_session_id: session.id,
        latitude,
        longitude,
        accuracy_m: Number.isFinite(Number(accuracyM)) ? Number(accuracyM) : null,
        inside_geofence: decision.shouldAutoCheckout ? false : true,
        geofence_radius_m: evaluation.radiusMeters || null,
        source: "member_app",
        metadata: eventMetadata,
        occurred_at: occurredAt,
      });
    }

    if (decision.shouldAutoCheckout && session?.id) {
      const checkOutAt = occurredAt;
      const durationMinutes = Math.round((new Date(checkOutAt).getTime() - new Date(session.check_in_at).getTime()) / 60000);

      await supabase
        .from("attendance_sessions")
        .update({
          status: "auto_closed",
          check_out_at: checkOutAt,
          duration_minutes: Math.max(0, durationMinutes),
          check_out_source: "system",
        })
        .eq("id", session.id);

      await supabase.from("attendance_logs").insert({
        gym_id: gymScope.gymId,
        attendance_session_id: session.id,
        member_id: memberId,
        action: "auto_check_out",
        source: "system",
        result: "success",
        reason_code: decision.reasonCode,
        message: "Member auto-checked out after a confirmed geofence exit.",
        actor_id: auth.context.userId,
        occurred_at: occurredAt,
        metadata: {
          latitude,
          longitude,
          distanceMeters: evaluation.distanceMeters,
          radiusMeters: evaluation.radiusMeters,
          geofenceDecision: decision.status,
          consecutiveOutsideSamples: decision.consecutiveOutsideSamples,
        },
      });

      publishAttendanceEvent({
        type: "auto_checkout",
        session_id: session.id,
        member_id: memberId,
        gym_id: gymScope.gymId,
        organization_id: auth.context.organizationId ?? "",
        branch_id: resolvedBranchId,
        reason: "geo_fence_exit",
      }).catch(() => {});

      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.geo_fence_auto_checkout",
        entityType: "attendance_session",
        entityId: session.id,
        metadata: {
          memberId,
          branchId: resolvedBranchId,
          latitude,
          longitude,
          distanceMeters: evaluation.distanceMeters,
          radiusMeters: evaluation.radiusMeters,
          geofenceDecision: decision.status,
          consecutiveOutsideSamples: decision.consecutiveOutsideSamples,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        insideGeofence: evaluation.insideFence,
        autoCheckedOut: decision.shouldAutoCheckout && Boolean(session?.id),
        sessionActive: responseSessionActive,
        geofenceEnabled: evaluation.enabled,
        branchId: resolvedBranchId,
        sessionId: session?.id ?? sessionId ?? null,
        message: decision.message,
        exitStatus: decision.status,
        reasonCode: decision.reasonCode,
        consecutiveOutsideSamples: decision.consecutiveOutsideSamples,
        outsideSampleThreshold: decision.outsideSampleThreshold,
        minimumAccuracyMeters: decision.minimumAccuracyMeters,
        graceWindowSeconds: decision.graceWindowSeconds
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
