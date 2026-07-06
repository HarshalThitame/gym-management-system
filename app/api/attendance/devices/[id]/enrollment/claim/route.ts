import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDeviceApiKey, hashDeviceApiKey } from "@/lib/security/device-auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const claimCode = typeof body.claim_code === "string" ? body.claim_code : typeof body.claimCode === "string" ? body.claimCode : "";
    if (!claimCode) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "claim_code is required." } }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: device } = await supabase
      .from("attendance_devices")
      .select("id, gym_id, organization_id, branch_id, status, is_active, metadata")
      .eq("id", id)
      .maybeSingle();

    if (!device) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
    }

    const enrollment = readEnrollmentState(device.metadata);
    const claimHash = hashDeviceApiKey(claimCode);
    if (!enrollment || enrollment.claim_code_hash !== claimHash) {
      return NextResponse.json({ ok: false, error: { code: "INVALID_CLAIM", message: "Enrollment code is invalid." } }, { status: 401 });
    }

    const expiresAt = enrollment.expires_at ? new Date(String(enrollment.expires_at)).getTime() : null;
    if (expiresAt && expiresAt < Date.now()) {
      return NextResponse.json({ ok: false, error: { code: "CLAIM_EXPIRED", message: "Enrollment code has expired." } }, { status: 401 });
    }

    const { plaintext, hash } = generateDeviceApiKey();
    const now = new Date().toISOString();
    const nextMetadata = {
      ...(device.metadata && typeof device.metadata === "object" ? device.metadata as Record<string, unknown> : {}),
      enrollment: {
        state: "claimed",
        claimed_at: now,
        claimed_by: "device",
        branch_id: enrollment.branch_id ?? device.branch_id ?? null,
      },
      health: {
        ...(readHealthState(device.metadata) ?? {}),
        claimed_at: now,
        acknowledged_at: null,
      }
    };

    const { error } = await supabase
      .from("attendance_devices")
      .update({
        api_key: hash,
        is_active: true,
        status: "online",
        branch_id: (enrollment.branch_id as string | null) ?? device.branch_id ?? null,
        last_seen_at: now,
        metadata: nextMetadata as never,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: { code: "UPDATE_FAILED", message: error.message } }, { status: 500 });
    }

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: device.gym_id,
      branch_id: (enrollment.branch_id as string | null) ?? device.branch_id ?? null,
      event_type: "config_change",
      payload: { action: "enrollment_claimed" },
      occurred_at: now,
    });

    await writeAuditLog({
      actorId: "system",
      gymId: device.gym_id,
      action: "attendance.device.enrollment_claimed",
      entityType: "attendance_device",
      entityId: id,
    });

    return NextResponse.json({
      ok: true,
      data: {
        api_key: plaintext,
        status: "online",
        claimed_at: now,
      }
    });
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

function readHealthState(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const health = (metadata as Record<string, unknown>).health;
  if (!health || typeof health !== "object") return null;
  return health as Record<string, unknown>;
}
