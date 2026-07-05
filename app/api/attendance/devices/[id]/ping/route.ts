import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDeviceRequest } from "@/lib/security/device-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateDeviceRequest(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (auth.device.id !== id) {
      return NextResponse.json(
        { ok: false, error: { code: "DEVICE_MISMATCH", message: "API key does not match device ID." } },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    await supabase
      .from("attendance_devices")
      .update({
        last_seen_at: now,
        status: "online",
      })
      .eq("id", id);

    await supabase.from("device_event_logs").insert({
      device_id: id,
      gym_id: auth.device.gym_id,
      branch_id: auth.device.branch_id,
      event_type: "ping",
      payload: { timestamp: now },
      occurred_at: now,
    });

    return NextResponse.json({
      ok: true,
      data: {
        status: "online",
        timestamp: now,
        server_time: now,
        config: {},
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
