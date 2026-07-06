import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDeviceRequest } from "@/lib/security/device-auth";
import { getDeviceHealthSnapshot } from "@/features/organization-owner/lib/device-health";
import { deriveDeviceIncident, incidentStatusForSnapshot } from "@/features/organization-owner/lib/device-incidents";

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
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const { data: device } = await supabase
      .from("attendance_devices")
      .select("id, status, last_seen_at, metadata")
      .eq("id", id)
      .maybeSingle();

    await supabase
      .from("attendance_devices")
      .update({
        last_seen_at: now,
        status: "online",
      })
      .eq("id", id);

    await supabase.from("device_health_logs").insert({
      device_id: id,
      status: getDeviceHealthSnapshot({ ...device, status: "online", last_seen_at: now }, new Date()).level,
      checked_at: now,
      battery_level: typeof body.battery_level === "number" ? body.battery_level : null,
      signal_strength: typeof body.signal_strength === "number" ? body.signal_strength : null,
      firmware_version: typeof body.firmware_version === "string" ? body.firmware_version : null,
    });

    const snapshot = getDeviceHealthSnapshot({ ...device, status: "online", last_seen_at: now }, new Date());
    const incidentTable = "device_health_incidents" as never;
    const incidentTypeMap = snapshot.level === "pending" || snapshot.level === "quarantined" || snapshot.level === "stale" || snapshot.level === "critical"
      ? deriveDeviceIncident(snapshot)
      : null;

    if (incidentTypeMap) {
      const { data: openIncident } = await supabase
        .from(incidentTable)
        .select("id")
        .eq("device_id", id)
        .eq("incident_type", incidentTypeMap.incidentType)
        .eq("status", "open")
        .maybeSingle();

      if (!openIncident) {
        await supabase.from(incidentTable).insert({
          device_id: id,
          gym_id: auth.device.gym_id,
          branch_id: auth.device.branch_id,
          incident_type: incidentTypeMap.incidentType,
          severity: incidentTypeMap.severity,
          status: "open",
          title: incidentTypeMap.title,
          description: incidentTypeMap.description ?? null,
          metadata: {
            source: "ping",
            status: incidentStatusForSnapshot(snapshot),
            battery_level: typeof body.battery_level === "number" ? body.battery_level : null,
            signal_strength: typeof body.signal_strength === "number" ? body.signal_strength : null,
            firmware_version: typeof body.firmware_version === "string" ? body.firmware_version : null,
          },
          detected_at: now,
          updated_at: now,
        });
      } else {
        await supabase
          .from(incidentTable)
          .update({
            severity: incidentTypeMap.severity,
            title: incidentTypeMap.title,
            description: incidentTypeMap.description ?? null,
            metadata: {
              source: "ping",
              status: incidentStatusForSnapshot(snapshot),
              battery_level: typeof body.battery_level === "number" ? body.battery_level : null,
              signal_strength: typeof body.signal_strength === "number" ? body.signal_strength : null,
              firmware_version: typeof body.firmware_version === "string" ? body.firmware_version : null,
            },
            updated_at: now,
          })
          .eq("id", openIncident.id);
      }
    } else {
      await supabase
        .from(incidentTable)
        .update({
          status: "resolved",
          resolved_at: now,
          resolved_by: null,
          updated_at: now,
        })
        .eq("device_id", id)
        .in("status", ["open", "acknowledged"])
        .in("incident_type", ["heartbeat_stale", "heartbeat_critical", "pending_activation", "quarantined"]);
    }

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
