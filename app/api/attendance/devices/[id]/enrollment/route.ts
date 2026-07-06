import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { generateDeviceEnrollmentCode } from "@/lib/security/device-auth";
import { writeAuditLog } from "@/lib/audit";

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
      .select("id, device_name, status, is_active, branch_id, metadata, created_at, updated_at, last_seen_at")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .maybeSingle();

    if (!device) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        device_id: device.id,
        status: device.status,
        is_active: device.is_active,
        branch_id: device.branch_id,
        last_seen_at: device.last_seen_at,
        enrollment: readEnrollmentState(device.metadata),
      }
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const minutesValid = Number(body.validMinutes ?? 30);
    const branchId = typeof body.branchId === "string" ? body.branchId : null;
    const note = typeof body.note === "string" ? body.note : null;
    const validMinutes = Number.isFinite(minutesValid) && minutesValid > 0 ? Math.min(Math.floor(minutesValid), 1440) : 30;
    const enrollmentCode = generateDeviceEnrollmentCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validMinutes * 60_000).toISOString();

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("attendance_devices")
      .select("id, metadata")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
    }

    const nextMetadata = {
      ...(readEnrollmentState(existing.metadata) ? { enrollment: readEnrollmentState(existing.metadata) } : {}),
      enrollment: {
        state: "pending",
        claim_code_hash: enrollmentCode.hash,
        issued_at: now.toISOString(),
        expires_at: expiresAt,
        branch_id: branchId,
        note,
        issued_by: auth.context.userId,
      }
    };

    const { error } = await supabase
      .from("attendance_devices")
      .update({
        status: "pending",
        is_active: false,
        api_key: null,
        branch_id: branchId ?? undefined,
        metadata: nextMetadata as never,
      })
      .eq("id", id)
      .eq("gym_id", gymScope.gymId);

    if (error) {
      return NextResponse.json({ ok: false, error: { code: "UPDATE_FAILED", message: error.message } }, { status: 500 });
    }

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: gymScope.gymId,
      branch_id: branchId,
      event_type: "config_change",
      payload: {
        action: "enrollment_claim_issued",
        validMinutes,
        branchId,
        note,
      },
      occurred_at: now.toISOString(),
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: "attendance.device.enrollment_claim_issued",
      entityType: "attendance_device",
      entityId: id,
      metadata: { validMinutes, branchId, note },
    });

    return NextResponse.json({
      ok: true,
      data: {
        device_id: id,
        status: "pending",
        claim_code: enrollmentCode.plaintext,
        expires_at: expiresAt,
      }
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}

function readEnrollmentState(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const enrollment = (metadata as Record<string, unknown>).enrollment;
  if (!enrollment || typeof enrollment !== "object") return null;
  return enrollment as Record<string, unknown>;
}
