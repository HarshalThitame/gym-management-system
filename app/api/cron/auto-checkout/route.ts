import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";

const MAX_SESSION_HOURS = 4;
const GEOFENCE_SWEEP_MINUTES = 15;

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 503 });
  }

  const cutoff = new Date(Date.now() - MAX_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const geofenceCutoff = new Date(Date.now() - GEOFENCE_SWEEP_MINUTES * 60 * 1000).toISOString();

  const [staleSessionsResult, geofenceEventsResult] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, member_id, gym_id, branch_id, check_in_at")
      .eq("status", "inside")
      .lt("check_in_at", cutoff),
    supabase
      .from("attendance_location_events")
      .select("id, member_id, gym_id, branch_id, attendance_session_id, latitude, longitude, occurred_at")
      .eq("inside_geofence", false)
      .gte("occurred_at", geofenceCutoff)
      .order("occurred_at", { ascending: false }),
  ]);

  if (staleSessionsResult.error) {
    return NextResponse.json({ error: staleSessionsResult.error.message }, { status: 500 });
  }
  if (geofenceEventsResult.error) {
    return NextResponse.json({ error: geofenceEventsResult.error.message }, { status: 500 });
  }

  const staleSessions = staleSessionsResult.data ?? [];
  const geofenceEvents = geofenceEventsResult.data ?? [];

  const sessionMap = new Map(staleSessions.map((session) => [session.id, session]));
  const insideMemberIds = [...new Set(geofenceEvents.map((event) => event.member_id))];

  if (insideMemberIds.length > 0) {
    const { data: geofenceSessions, error: geofenceSessionError } = await supabase
      .from("attendance_sessions")
      .select("id, member_id, gym_id, branch_id, check_in_at")
      .eq("status", "inside")
      .in("member_id", insideMemberIds);

    if (geofenceSessionError) {
      return NextResponse.json({ error: geofenceSessionError.message }, { status: 500 });
    }

    for (const session of geofenceSessions ?? []) {
      sessionMap.set(session.id, session);
    }
  }

  const sessionIds = Array.from(sessionMap.keys());

  if (sessionIds.length === 0) {
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      autoCheckedOut: 0,
      message: "No stale sessions found",
    });
  }

  const { error: updateError } = await supabase
    .from("attendance_sessions")
    .update({
      status: "auto_closed",
      check_out_at: new Date().toISOString(),
      check_out_source: "system",
    })
    .in("id", sessionIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const logInserts = Array.from(sessionMap.values()).map((session) => {
    const geofenceEvent = geofenceEvents.find((event) => event.member_id === session.member_id);
    return {
      gym_id: session.gym_id,
      attendance_session_id: session.id,
      member_id: session.member_id,
      action: "auto_check_out" as const,
      source: "system" as const,
      result: "success" as const,
      reason_code: geofenceEvent ? "geo_fence_exit" : "session_timeout",
      message: geofenceEvent
        ? "Auto-checked out after a geo-fence exit."
        : `Auto-checked out after ${MAX_SESSION_HOURS} hours of inactivity.`,
      occurred_at: new Date().toISOString(),
      metadata: geofenceEvent
        ? {
            latitude: geofenceEvent.latitude,
            longitude: geofenceEvent.longitude,
            branch_id: geofenceEvent.branch_id,
            location_event_id: geofenceEvent.id,
          }
        : {},
    };
  });

  if (logInserts.length > 0) {
    await supabase.from("attendance_logs").insert(logInserts);
  }

  // Publish events for each auto-checkout
  const gymIds = [...new Set(Array.from(sessionMap.values()).map((s) => s.gym_id))];
  const orgMap = new Map<string, string>();
  if (gymIds.length > 0) {
    const { data: gyms } = await supabase
      .from("gyms")
      .select("id, organization_id")
      .in("id", gymIds);
    for (const g of gyms ?? []) orgMap.set(g.id, g.organization_id);
  }

  for (const session of sessionMap.values()) {
    const orgId = orgMap.get(session.gym_id);
    if (!orgId) continue;
    publishAttendanceEvent({
      type: "auto_checkout",
      session_id: session.id,
      member_id: session.member_id,
      gym_id: session.gym_id,
      organization_id: orgId,
      reason: `Session auto-closed after ${MAX_SESSION_HOURS}h or geo-fence exit`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    autoCheckedOut: sessionIds.length,
    sessionIds,
  });
}
