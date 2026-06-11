import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/services/email/resend";

type CronScheduleRow = {
  id: string;
  email: string;
  next_run_at: string;
};

type CronScheduleClient = {
  from(table: "platform_dashboard_email_schedules"): {
    select(columns: string): {
      eq(column: "status", value: "active"): {
        lte(column: "next_run_at", value: string): {
          limit(count: number): Promise<{ data: CronScheduleRow[] | null; error: { message: string } | null }>;
        };
      };
    };
    update(payload: { last_sent_at: string; next_run_at: string }): {
      eq(column: "id", value: string): Promise<{ error: { message: string } | null }>;
    };
  };
  from(table: "organization_subscriptions"): {
    select(columns: string, options: { count: "exact"; head: true }): Promise<{ count: number | null; error: { message: string } | null }>;
  };
};

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
  }

  const admin = supabase;
  const scheduleClient = admin as unknown as CronScheduleClient;
  const now = new Date();
  const { data: schedules, error } = await scheduleClient
    .from("platform_dashboard_email_schedules")
    .select("id, email, next_run_at")
    .eq("status", "active")
    .lte("next_run_at", now.toISOString())
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = await buildSummary();
  let sent = 0;
  const failures: Array<{ email: string; reason: string }> = [];

  for (const schedule of schedules ?? []) {
    const result = await sendEmail({
      to: schedule.email,
      subject: "Weekly Super Admin dashboard summary",
      html: summary
    });

    if (!result.sent) {
      failures.push({ email: schedule.email, reason: result.reason ?? "Email failed." });
      continue;
    }

    sent += 1;
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 7);
    nextRun.setHours(9, 0, 0, 0);

    await scheduleClient
      .from("platform_dashboard_email_schedules")
      .update({
        last_sent_at: now.toISOString(),
        next_run_at: nextRun.toISOString()
      })
      .eq("id", schedule.id);
  }

  return NextResponse.json({ ok: true, due: schedules?.length ?? 0, sent, failures });

  async function buildSummary() {
    const since = new Date(now);
    since.setDate(since.getDate() - 7);
    const [
      organizations,
      gyms,
      branches,
      subscriptions,
      payments,
      refunds,
      securityEvents,
      healthChecks
    ] = await Promise.all([
      admin.from("organizations").select("id", { count: "exact", head: true }),
      admin.from("gyms").select("id", { count: "exact", head: true }),
      admin.from("branches").select("id", { count: "exact", head: true }),
      scheduleClient.from("organization_subscriptions").select("id", { count: "exact", head: true }),
      admin.from("payments").select("amount, status, created_at").in("status", ["paid", "partially_refunded"]).gte("created_at", since.toISOString()),
      admin.from("refunds").select("amount, status, created_at").eq("status", "processed").gte("created_at", since.toISOString()),
      admin.from("security_events").select("id", { count: "exact", head: true }).in("status", ["open", "investigating"]),
      admin.from("system_health_checks").select("id", { count: "exact", head: true }).in("status", ["down", "degraded", "unknown"]).gte("checked_at", since.toISOString())
    ]);
    const paid = payments.data ?? [];
    const processedRefunds = refunds.data ?? [];
    const grossRevenue = paid.reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
    const refundAmount = processedRefunds.reduce((total, refund) => total + Number(refund.amount ?? 0), 0);

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <h1 style="margin:0 0 12px">Weekly Super Admin Dashboard Summary</h1>
        <p style="margin:0 0 20px">Period: ${since.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}</p>
        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px">
          ${row("Organizations", organizations.count ?? 0)}
          ${row("Gyms", gyms.count ?? 0)}
          ${row("Branches", branches.count ?? 0)}
          ${row("Package assignments", subscriptions.count ?? 0)}
          ${row("Net revenue", formatInr(grossRevenue - refundAmount))}
          ${row("Open security events", securityEvents.count ?? 0)}
          ${row("Unhealthy health checks", healthChecks.count ?? 0)}
        </table>
      </div>
    `;
  }
}

function row(label: string, value: string | number) {
  return `<tr><td style="border:1px solid #e5e7eb;font-weight:700">${label}</td><td style="border:1px solid #e5e7eb">${value}</td></tr>`;
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}
