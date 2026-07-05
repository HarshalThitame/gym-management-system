import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { publishAttendanceEvent } from "@/lib/realtime/event-bus";

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

  const now = new Date();
  const results: string[] = [];

  const { data: branches, error: branchError } = await supabase
    .from("branches")
    .select("id, gym_id, organization_id, capacity")
    .neq("status", "archived");

  if (branchError) {
    return NextResponse.json({ error: branchError.message }, { status: 500 });
  }

  for (const branch of branches ?? []) {
    const { count: membersInGym, error: countError } = await supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("branch_id", branch.id)
      .eq("status", "inside");

    if (countError) {
      results.push(`Branch ${branch.id}: count error - ${countError.message}`);
      continue;
    }

    const capacity = branch.capacity ?? 100;
    const occupancyPercent = capacity > 0
      ? Math.round((((membersInGym ?? 0) / capacity) * 100) * 100) / 100
      : 0;

    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    const { error: insertError } = await supabase.from("occupancy_log").insert({
      gym_id: branch.gym_id,
      branch_id: branch.id,
      organization_id: branch.organization_id,
      timestamp: now.toISOString(),
      members_in_gym: membersInGym ?? 0,
      total_capacity: capacity,
      occupancy_percent: occupancyPercent,
      hour_of_day: hour,
      day_of_week: day,
    });

    if (insertError) {
      results.push(`Branch ${branch.id}: insert error - ${insertError.message}`);
    } else {
      publishAttendanceEvent({
        type: "occupancy_update",
        gym_id: branch.gym_id,
        organization_id: branch.organization_id,
        inside_count: membersInGym ?? 0,
        capacity_percent: occupancyPercent,
      }).catch(() => {});
      results.push(`Branch ${branch.id}: ${membersInGym}/${capacity} (${occupancyPercent}%)`);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    branchesProcessed: branches?.length ?? 0,
    results,
  });
}
