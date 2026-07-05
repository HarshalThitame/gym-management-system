import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";

async function loadMapping(deviceId: string, mappingId: string, gymId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("member_device_mappings")
    .select("id, member_id, device_id, gym_id, device_user_id, device_user_name, is_active, created_at, updated_at")
    .eq("id", mappingId)
    .eq("device_id", deviceId)
    .eq("gym_id", gymId)
    .maybeSingle();

  return data ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mappingId: string }> }
) {
  try {
    const auth = await requireApiPermission("attendance", "write");
    if (!auth.ok) return auth.response;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { id, mappingId } = await params;
    const existing = await loadMapping(id, mappingId, gymScope.gymId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Mapping not found." } }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if (typeof body.deviceUserId === "string") updates.device_user_id = body.deviceUserId.trim();
    if (typeof body.device_user_id === "string") updates.device_user_id = body.device_user_id.trim();
    if (typeof body.deviceUserName === "string") updates.device_user_name = body.deviceUserName.trim();
    if (typeof body.device_user_name === "string") updates.device_user_name = body.device_user_name.trim();
    if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "No mapping fields provided." } }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: conflicting } = updates.device_user_id
      ? await supabase
          .from("member_device_mappings")
          .select("id, member_id")
          .eq("device_id", id)
          .eq("device_user_id", String(updates.device_user_id))
          .neq("id", mappingId)
          .maybeSingle()
      : { data: null };

    if (conflicting) {
      return NextResponse.json(
        { ok: false, error: { code: "CONFLICT", message: "That device user ID is already mapped to another member." } },
        { status: 409 }
      );
    }

    const { data: mapping, error } = await supabase
      .from("member_device_mappings")
      .update(updates)
      .eq("id", mappingId)
      .eq("device_id", id)
      .eq("gym_id", gymScope.gymId)
      .select("*")
      .single();

    if (error || !mapping) {
      return NextResponse.json(
        { ok: false, error: { code: "SAVE_FAILED", message: error?.message ?? "Failed to update mapping." } },
        { status: 500 }
      );
    }

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: gymScope.gymId,
      branch_id: null,
      event_type: "config_change",
      payload: { action: "mapping_updated", mapping_id: mappingId, updates: Object.keys(updates) },
      occurred_at: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: "attendance.device.mapping_updated",
      entityType: "attendance_device_mapping",
      entityId: mappingId,
      metadata: { deviceId: id, updates: Object.keys(updates) },
    });

    return NextResponse.json({ ok: true, data: mapping });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; mappingId: string }> }
) {
  try {
    const auth = await requireApiPermission("attendance", "write");
    if (!auth.ok) return auth.response;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { id, mappingId } = await params;
    const existing = await loadMapping(id, mappingId, gymScope.gymId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Mapping not found." } }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("member_device_mappings")
      .update({ is_active: false })
      .eq("id", mappingId)
      .eq("device_id", id)
      .eq("gym_id", gymScope.gymId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "SAVE_FAILED", message: error.message } },
        { status: 500 }
      );
    }

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: gymScope.gymId,
      branch_id: null,
      event_type: "config_change",
      payload: { action: "mapping_deactivated", mapping_id: mappingId },
      occurred_at: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: "attendance.device.mapping_deactivated",
      entityType: "attendance_device_mapping",
      entityId: mappingId,
      metadata: { deviceId: id, memberId: existing.member_id },
    });

    return NextResponse.json({ ok: true, data: { id: mappingId, is_active: false } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
