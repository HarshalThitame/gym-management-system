import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";

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

    const supabase = createAdminClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const [todaySessions, insideSessions, weeklySessions, monthlySessions, peakData, alerts] =
      await Promise.all([
        supabase
          .from("attendance_sessions")
          .select("id, check_in_at, check_out_at, duration_minutes, member_id", { count: "exact" })
          .eq("gym_id", gymScope.gymId)
          .gte("check_in_at", todayStart)
          .lt("check_in_at", todayEnd),

        supabase
          .from("attendance_sessions")
          .select("id, member_id, branch_id, check_in_at, members(full_name, member_code, phone)")
          .eq("gym_id", gymScope.gymId)
          .eq("status", "inside")
          .order("check_in_at", { ascending: true }),

        supabase
          .from("attendance_sessions")
          .select("id", { count: "exact" })
          .eq("gym_id", gymScope.gymId)
          .gte("check_in_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        supabase
          .from("attendance_sessions")
          .select("id", { count: "exact" })
          .eq("gym_id", gymScope.gymId)
          .gte("check_in_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),

        supabase
          .from("attendance_sessions")
          .select("check_in_at")
          .eq("gym_id", gymScope.gymId)
          .gte("check_in_at", todayStart)
          .lt("check_in_at", todayEnd),

        supabase
          .from("attendance_alerts")
          .select("id, member_id, alert_type, severity, status, message, created_at")
          .eq("gym_id", gymScope.gymId)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    if (todaySessions.error) {
      return NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED", message: todaySessions.error.message } },
        { status: 500 }
      );
    }

    const checkedInToday = todaySessions.data?.length || 0;
    const currentInside = insideSessions.data?.length || 0;
    const weeklyCount = weeklySessions.count || 0;
    const monthlyCount = monthlySessions.count || 0;

    const totalDuration = (todaySessions.data || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const avgDuration = checkedInToday > 0 ? Math.round(totalDuration / checkedInToday) : 0;

    const hourlyTraffic: Record<string, number> = {};
    (peakData.data || []).forEach((s) => {
      const hour = s.check_in_at.substring(11, 13) + ":00";
      hourlyTraffic[hour] = (hourlyTraffic[hour] || 0) + 1;
    });
    const hourlyTrafficArray = Object.entries(hourlyTraffic)
      .map(([hour, visits]) => ({ hour, visits }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    const peakHourEntry = hourlyTrafficArray.reduce(
      (max, curr) => (curr.visits > max.visits ? curr : max),
      hourlyTrafficArray[0] || { hour: null, visits: 0 }
    );

    return NextResponse.json({
      ok: true,
      data: {
        metrics: {
          todayCheckIns: checkedInToday,
          currentInside,
          weeklyAttendance: weeklyCount,
          monthlyAttendance: monthlyCount,
          averageDurationMinutes: avgDuration,
          peakHour: peakHourEntry.hour,
          peakHourVisits: peakHourEntry.visits,
        },
        currentSessions: insideSessions.data || [],
        hourlyTraffic: hourlyTrafficArray,
        alerts: alerts.data || [],
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
