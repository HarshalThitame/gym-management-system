import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { generateDeviceApiKey } from "@/lib/security/device-auth";

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
    const status = searchParams.get("status");
    const deviceTypeId = searchParams.get("device_type_id");
    const branchId = searchParams.get("branch_id");

    const supabase = createAdminClient();

    let query = supabase
      .from("attendance_devices")
      .select("*, device_types(name, code, manufacturer, model)", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("gym_id", gymScope.gymId);

    if (status) query = query.eq("status", status);
    if (deviceTypeId) query = query.eq("device_type_id", deviceTypeId);
    if (branchId) query = query.eq("branch_id", branchId);

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: devices, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: devices,
      meta: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
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

    const body = await request.json() as Record<string, unknown>;
    const { device_name, device_type_id, branch_id, location, ip_address, serial_number } = body;

    if (!device_name || typeof device_name !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "device_name is required." } },
        { status: 400 }
      );
    }
    if (!device_type_id || typeof device_type_id !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "device_type_id is required." } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: type } = await supabase
      .from("device_types")
      .select("id")
      .eq("id", device_type_id)
      .single();

    if (!type) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_DEVICE_TYPE", message: "Device type not found." } },
        { status: 400 }
      );
    }

    const { plaintext, hash } = generateDeviceApiKey();

    const { data: device, error: insertError } = await supabase
      .from("attendance_devices")
      .insert({
        device_name,
        device_type_id,
        organization_id: organizationId,
        gym_id: gymScope.gymId,
        branch_id: (branch_id as string) || null,
        api_key: hash,
        ip_address: (ip_address as string) || null,
        serial_number: (serial_number as string) || null,
        location: (location as string) || null,
        is_active: true,
        status: "offline",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: { code: "INSERT_FAILED", message: insertError.message } },
        { status: 500 }
      );
    }

    await supabase.from("device_event_logs").insert({
      device_id: device.id,
      gym_id: gymScope.gymId,
      branch_id: (branch_id as string) || null,
      event_type: "config_change",
      payload: { action: "registered", registered_by: auth.context.userId },
      occurred_at: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: "attendance.device.registered",
      entityType: "attendance_device",
      entityId: device.id,
      metadata: { device_name, device_type_id },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...device,
          api_key: plaintext,
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
