import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission("attendance", "read");
    if (!auth.ok) return auth.response;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), 50);
    const offset = (page - 1) * limit;
    const eventType = searchParams.get("event_type");

    const supabase = createAdminClient();

    // Verify device belongs to this gym
    const { data: device } = await supabase
      .from("attendance_devices")
      .select("id")
      .eq("id", id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (!device) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Device not found." } },
        { status: 404 }
      );
    }

    let query = supabase
      .from("device_event_logs")
      .select("*", { count: "exact" })
      .eq("device_id", id);

    if (eventType) query = query.eq("event_type", eventType);

    const { data, count, error } = await query
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data,
      meta: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
