import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { getDeviceHealthSnapshot } from "@/features/organization-owner/lib/device-health";
import { generateDeviceEnrollmentCode } from "@/lib/security/device-auth";
import { deriveDeviceIncident } from "@/features/organization-owner/lib/device-incidents";

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

    const { data: device } = await supabase
      .from("attendance_devices")
      .select("id, device_name, status, is_active, branch_id, metadata, last_seen_at, created_at, updated_at, firmware_version")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .maybeSingle();

    if (!device) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
    }

    const { data: healthLogs } = await supabase
      .from("device_health_logs")
      .select("*")
      .eq("device_id", id)
      .order("checked_at", { ascending: false })
      .limit(10);

    const { data: incidents } = await supabase
      .from("device_health_incidents" as never)
      .select("*")
      .eq("device_id", id)
      .order("detected_at", { ascending: false })
      .limit(10);

    const snapshot = getDeviceHealthSnapshot(device);

    return NextResponse.json({
      ok: true,
      data: {
        device,
        snapshot,
        health_logs: healthLogs ?? [],
        incidents: incidents ?? [],
        health_state: readHealthState(device.metadata),
      }
    });
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

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const note = typeof body.note === "string" ? body.note : null;
    const supabase = createAdminClient();

    const { data: device } = await supabase
      .from("attendance_devices")
      .select("id, device_name, status, is_active, branch_id, metadata, gym_id")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .maybeSingle();

    if (!device) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
    }

    const metadata = (device.metadata && typeof device.metadata === "object" ? device.metadata as Record<string, unknown> : {});
    const now = new Date().toISOString();

    if (action === "acknowledge") {
      metadata.health = {
        ...(readHealthState(device.metadata) ?? {}),
        acknowledged_at: now,
        acknowledged_by: auth.context.userId,
        note,
      };

      const { error } = await supabase.from("attendance_devices").update({ metadata: metadata as never }).eq("id", id);
      if (error) {
        return NextResponse.json({ ok: false, error: { code: "UPDATE_FAILED", message: error.message } }, { status: 500 });
      }

      await supabase.from("device_event_logs").insert({
        device_id: id,
        gym_id: gymScope.gymId,
        branch_id: device.branch_id,
        event_type: "config_change",
        payload: { action: "health_acknowledged", note },
        occurred_at: now,
      });

      await supabase
        .from("device_health_incidents" as never)
        .update({
          status: "acknowledged",
          acknowledged_at: now,
          acknowledged_by: auth.context.userId,
          updated_at: now,
        })
        .eq("device_id", id)
        .eq("status", "open")
        .in("incident_type", ["pending_activation", "heartbeat_stale", "heartbeat_critical", "quarantined"]);

      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.device.health_acknowledged",
        entityType: "attendance_device",
        entityId: id,
        metadata: { note },
      });

      return NextResponse.json({ ok: true, data: { id, status: device.status, acknowledged_at: now } });
    }

    if (action === "quarantine") {
      const incident = deriveDeviceIncident({
        status: "quarantined",
        last_seen_at: device.last_seen_at,
      });

      metadata.health = {
        ...(readHealthState(device.metadata) ?? {}),
        quarantined_at: now,
        quarantined_by: auth.context.userId,
        reason: note,
      };

      const { error } = await supabase.from("attendance_devices").update({
        is_active: false,
        status: "quarantined",
        metadata: metadata as never,
      }).eq("id", id);
      if (error) {
        return NextResponse.json({ ok: false, error: { code: "UPDATE_FAILED", message: error.message } }, { status: 500 });
      }

      await supabase.from("device_event_logs").insert({
        device_id: id,
        gym_id: gymScope.gymId,
        branch_id: device.branch_id,
        event_type: "error",
        payload: { action: "quarantined", note },
        occurred_at: now,
      });

      await supabase.from("device_health_incidents" as never).insert({
        device_id: id,
        gym_id: gymScope.gymId,
        branch_id: device.branch_id,
        incident_type: incident?.incidentType ?? "manual_action",
        severity: incident?.severity ?? "critical",
        status: "open",
        title: incident?.title ?? "Device quarantined",
        description: note ?? incident?.description ?? null,
        metadata: {
          action: "quarantine",
          reason: note,
        },
        detected_at: now,
        updated_at: now,
      });

      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.device.quarantined",
        entityType: "attendance_device",
        entityId: id,
        metadata: { note },
      });

      return NextResponse.json({ ok: true, data: { id, status: "quarantined", quarantined_at: now } });
    }

    if (action === "reissue_claim") {
      const code = generateDeviceEnrollmentCode();
      const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
      metadata.enrollment = {
        state: "pending",
        claim_code_hash: code.hash,
        issued_at: now,
        expires_at: expiresAt,
        issued_by: auth.context.userId,
        branch_id: device.branch_id ?? null,
        note,
      };

      const { error } = await supabase.from("attendance_devices").update({
        is_active: false,
        status: "pending",
        api_key: null,
        metadata: metadata as never,
      }).eq("id", id);
      if (error) {
        return NextResponse.json({ ok: false, error: { code: "UPDATE_FAILED", message: error.message } }, { status: 500 });
      }

      await supabase.from("device_event_logs").insert({
        device_id: id,
        gym_id: gymScope.gymId,
        branch_id: device.branch_id,
        event_type: "config_change",
        payload: { action: "enrollment_claim_reissued", note },
        occurred_at: now,
      });

      await supabase.from("device_health_incidents" as never).insert({
        device_id: id,
        gym_id: gymScope.gymId,
        branch_id: device.branch_id,
        incident_type: "pending_activation",
        severity: "warning",
        status: "open",
        title: "Enrollment claim reissued",
        description: note ?? "A new enrollment claim was issued for the device.",
        metadata: {
          action: "reissue_claim",
          expires_at: expiresAt,
        },
        detected_at: now,
        updated_at: now,
      });

      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.device.enrollment_claim_reissued",
        entityType: "attendance_device",
        entityId: id,
        metadata: { note },
      });

      return NextResponse.json({
        ok: true,
        data: { id, status: "pending", claim_code: code.plaintext, expires_at: expiresAt }
      });
    }

    if (action === "resolve") {
      metadata.health = {
        ...(readHealthState(device.metadata) ?? {}),
        resolved_at: now,
        resolved_by: auth.context.userId,
        note,
      };

      const { error } = await supabase.from("attendance_devices").update({ metadata: metadata as never }).eq("id", id);
      if (error) {
        return NextResponse.json({ ok: false, error: { code: "UPDATE_FAILED", message: error.message } }, { status: 500 });
      }

      await supabase.from("device_health_incidents" as never).update({
        status: "resolved",
        resolved_at: now,
        resolved_by: auth.context.userId,
        updated_at: now,
      }).eq("device_id", id).in("status", ["open", "acknowledged"]);

      await supabase.from("device_event_logs").insert({
        device_id: id,
        gym_id: gymScope.gymId,
        branch_id: device.branch_id,
        event_type: "config_change",
        payload: { action: "health_resolved", note },
        occurred_at: now,
      });

      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.device.health_resolved",
        entityType: "attendance_device",
        entityId: id,
        metadata: { note },
      });

      return NextResponse.json({ ok: true, data: { id, status: device.status, resolved_at: now } });
    }

    return NextResponse.json(
      { ok: false, error: { code: "INVALID_ACTION", message: "Unsupported health action." } },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}

function readHealthState(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const health = (metadata as Record<string, unknown>).health;
  if (!health || typeof health !== "object") return null;
  return health as Record<string, unknown>;
}
