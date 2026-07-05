import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";

async function ensureDeviceInGym(deviceId: string, gymId: string) {
  const supabase = createAdminClient();
  const { data: device } = await supabase
    .from("attendance_devices")
    .select("id, device_name, gym_id, organization_id")
    .eq("id", deviceId)
    .eq("gym_id", gymId)
    .single();

  return device ?? null;
}

async function loadMembers(memberIds: string[]) {
  if (memberIds.length === 0) return new Map<string, { id: string; full_name: string | null; member_code: string | null; phone: string | null; email: string | null }>();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("members")
    .select("id, full_name, member_code, phone, email")
    .in("id", memberIds);

  const map = new Map<string, { id: string; full_name: string | null; member_code: string | null; phone: string | null; email: string | null }>();
  for (const member of data ?? []) {
    map.set(member.id, member);
  }
  return map;
}

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
    const device = await ensureDeviceInGym(id, gymScope.gymId);
    if (!device) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { data: mappings, error } = await supabase
      .from("member_device_mappings")
      .select("id, member_id, device_id, gym_id, device_user_id, device_user_name, is_active, created_at, updated_at")
      .eq("device_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: { code: "QUERY_FAILED", message: error.message } }, { status: 500 });
    }

    const memberMap = await loadMembers((mappings ?? []).map((mapping) => mapping.member_id));
    const data = (mappings ?? []).map((mapping) => ({
      ...mapping,
      member: memberMap.get(mapping.member_id) ?? null,
    }));

    return NextResponse.json({ ok: true, data });
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
    const device = await ensureDeviceInGym(id, gymScope.gymId);
    if (!device) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const memberId = typeof body.memberId === "string" ? body.memberId : typeof body.member_id === "string" ? body.member_id : null;
    const deviceUserId = typeof body.deviceUserId === "string" ? body.deviceUserId.trim() : typeof body.device_user_id === "string" ? body.device_user_id.trim() : "";
    const deviceUserName = typeof body.deviceUserName === "string" ? body.deviceUserName.trim() : typeof body.device_user_name === "string" ? body.device_user_name.trim() : null;
    const isActive = body.isActive === undefined && body.is_active === undefined ? true : body.isActive === true || body.is_active === true;

    if (!memberId || !deviceUserId) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "memberId and deviceUserId are required." } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: member } = await supabase
      .from("members")
      .select("id, full_name, member_code, gym_id")
      .eq("id", memberId)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (!member) {
      return NextResponse.json({ ok: false, error: { code: "MEMBER_NOT_FOUND", message: "Member not found in this gym." } }, { status: 404 });
    }

    const { data: existingMemberMapping } = await supabase
      .from("member_device_mappings")
      .select("id, member_id, device_user_id")
      .eq("device_id", id)
      .eq("member_id", memberId)
      .maybeSingle();

    const { data: existingUserMapping } = await supabase
      .from("member_device_mappings")
      .select("id, member_id, device_user_id")
      .eq("device_id", id)
      .eq("device_user_id", deviceUserId)
      .maybeSingle();

    if (existingUserMapping && existingUserMapping.member_id !== memberId) {
      return NextResponse.json(
        { ok: false, error: { code: "CONFLICT", message: "That device user ID is already mapped to another member." } },
        { status: 409 }
      );
    }

    const payload = {
      member_id: memberId,
      gym_id: gymScope.gymId,
      device_id: id,
      device_user_id: deviceUserId,
      device_user_name: deviceUserName,
      is_active: isActive,
    };

    const { data: mapping, error } = existingMemberMapping
      ? await supabase.from("member_device_mappings").update(payload).eq("id", existingMemberMapping.id).select("*").single()
      : await supabase.from("member_device_mappings").insert(payload).select("*").single();

    if (error || !mapping) {
      return NextResponse.json(
        { ok: false, error: { code: "SAVE_FAILED", message: error?.message ?? "Failed to save mapping." } },
        { status: 500 }
      );
    }

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: gymScope.gymId,
      branch_id: device.branch_id,
      event_type: "config_change",
      payload: {
        action: existingMemberMapping ? "mapping_updated" : "mapping_created",
        mapping_id: mapping.id,
        member_id: memberId,
        device_user_id: deviceUserId,
        is_active: isActive,
      },
      occurred_at: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: existingMemberMapping ? "attendance.device.mapping_updated" : "attendance.device.mapping_created",
      entityType: "attendance_device_mapping",
      entityId: mapping.id,
      metadata: {
        deviceId: id,
        memberId,
        deviceUserId,
        isActive,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...mapping,
        member,
      },
    }, { status: existingMemberMapping ? 200 : 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
