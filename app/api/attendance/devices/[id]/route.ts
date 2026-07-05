import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { generateDeviceApiKey } from "@/lib/security/device-auth";

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

    const { data: device, error } = await supabase
      .from("attendance_devices")
      .select("*, device_types(name, code, manufacturer, model)")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (error || !device) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Device not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: device });
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

    const { data: existing } = await supabase
      .from("attendance_devices")
      .select("id, device_name, device_type_id")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Device not found." } },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = [
      "device_name", "branch_id", "location", "ip_address",
      "firmware_version", "is_active", "serial_number",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (body.regenerate_api_key === true) {
      const { plaintext, hash } = generateDeviceApiKey();
      updates.api_key = hash;
      updates._new_plaintext_key = plaintext;
    }

    if (Object.keys(updates).filter((k) => !k.startsWith("_")).length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_UPDATES", message: "No valid fields to update." } },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("attendance_devices")
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

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: gymScope.gymId,
      event_type: "config_change",
      payload: { updates: Object.keys(updates).filter((k) => !k.startsWith("_")) },
      occurred_at: new Date().toISOString(),
    });

    if (organizationId) {
      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.device.updated",
        entityType: "attendance_device",
        entityId: id,
        metadata: { updates: Object.keys(updates) },
      });
    }

    const responseData = { ...updated };
    if ((updates as any)._new_plaintext_key) {
      responseData.api_key = (updates as any)._new_plaintext_key;
    } else {
      delete responseData.api_key;
    }

    return NextResponse.json({ ok: true, data: responseData });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission("attendance", "write");
    if (!auth.ok) return auth.response;

    const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("attendance_devices")
      .select("id")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Device not found." } },
        { status: 404 }
      );
    }

    await supabase.from("attendance_devices").update({ is_active: false, status: "decommissioned" }).eq("id", id);

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: gymScope.gymId,
      event_type: "config_change",
      payload: { action: "decommissioned", decommissioned_by: auth.context.userId },
      occurred_at: new Date().toISOString(),
    });

    if (organizationId) {
      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.device.decommissioned",
        entityType: "attendance_device",
        entityId: id,
      });
    }

    return NextResponse.json({ ok: true, data: { id, status: "decommissioned" } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
