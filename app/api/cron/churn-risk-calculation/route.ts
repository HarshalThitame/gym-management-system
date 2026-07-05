import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const CHURN_DAYS_THRESHOLD = 14;
const HIGH_RISK_DAYS = 21;
const CRITICAL_RISK_DAYS = 30;

async function calculateChurnRisk(
  daysSinceLastVisit: number,
  avgWeeklyCheckins: number
): Promise<{ score: number; category: "low" | "medium" | "high" | "critical" }> {
  const recencyScore = Math.min(
    (daysSinceLastVisit / CRITICAL_RISK_DAYS) * 60,
    60
  );
  const frequencyScore = Math.min(
    (1 - Math.min(avgWeeklyCheckins / 7, 1)) * 40,
    40
  );
  const score = Math.round(recencyScore + frequencyScore);

  let category: "low" | "medium" | "high" | "critical" = "low";
  if (score >= 75) category = "critical";
  else if (score >= 50) category = "high";
  else if (score >= 25) category = "medium";

  return { score, category };
}

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client not configured" },
      { status: 503 }
    );
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select(`
      id,
      gym_id,
      branch_id,
      organization_id,
      last_attendance_date,
      membership_expiry,
      membership_status,
      attendance_sessions (
        check_in_at,
        check_out_at
      )
    `)
    .in("membership_status", ["active", "expired"])
    .limit(500);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      membersAssessed: 0,
      highRiskCount: 0,
      message: "No members found",
    });
  }

  type MemberRow = (typeof members)[number] & {
    attendance_sessions: { check_in_at: string; check_out_at: string | null }[];
  };

  const results: {
    memberId: string;
    riskScore: number;
    category: string;
    daysSinceLastVisit: number;
  }[] = [];

  for (const raw of members as MemberRow[]) {
    const lastVisit = raw.last_attendance_date
      ? new Date(raw.last_attendance_date)
      : null;
    const daysSinceLastVisit = lastVisit
      ? Math.floor(
          (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 999;

    if (daysSinceLastVisit < CHURN_DAYS_THRESHOLD && raw.membership_status === "active") {
      continue;
    }

    const sessions = raw.attendance_sessions ?? [];
    const recentSessions = sessions.filter((s) => {
      const d = new Date(s.check_in_at);
      const weeksAgo = new Date(now);
      weeksAgo.setDate(now.getDate() - 28);
      return d >= weeksAgo;
    });

    const avgWeeklyCheckins = recentSessions.length / 4;

    const { score, category } = await calculateChurnRisk(
      daysSinceLastVisit,
      avgWeeklyCheckins
    );

    if (score === 0) continue;

    const { error: upsertError } = await supabase
      .from("attendance_analytics")
      .upsert(
        {
          member_id: raw.id,
          gym_id: raw.gym_id,
          branch_id: raw.branch_id,
          organization_id: raw.organization_id,
          week_start_date: weekStartStr,
          month: currentMonth,
          year: currentYear,
          churn_risk_score: score,
          last_risk_assessment: now.toISOString(),
        },
        {
          onConflict: "member_id, week_start_date",
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      console.error(
        `[ChurnRisk] Failed to upsert for member ${raw.id}:`,
        upsertError
      );
    }

    results.push({
      memberId: raw.id,
      riskScore: score,
      category,
      daysSinceLastVisit,
    });
  }

  const highRiskCount = results.filter(
    (r) => r.category === "high" || r.category === "critical"
  ).length;

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    membersAssessed: results.length,
    highRiskCount,
    avgRiskScore:
      results.length > 0
        ? Math.round(
            results.reduce((sum, r) => sum + r.riskScore, 0) / results.length
          )
        : 0,
  });
}
