import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateReportPdfInternal, calculateNextScheduledAt, type ReportType } from "@/features/organization-owner/lib/report-schedule-utils";
import { sendEmail } from "@/services/email/resend";

type ReportScheduleRow = {
  id: string;
  organization_id: string;
  name: string;
  report_type: ReportType;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  recipients: string[];
  is_active: boolean;
  last_sent_at: string | null;
  next_scheduled_at: string | null;
};

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
  }

  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedules, error } = await (supabase as any)
    .from("report_schedules")
    .select("*")
    .eq("is_active", true)
    .lte("next_scheduled_at", now.toISOString())
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let processed = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const s of (schedules ?? []) as ReportScheduleRow[]) {
    processed++;
    const recipients = s.recipients ?? [];

    if (recipients.length === 0) {
      await updateNextRun(supabase, s.id, s.frequency, s.day_of_week, s.day_of_month);
      continue;
    }

    try {
      // Generate PDF using admin client (bypasses RLS/auth)
      const { fileName } = await generateReportPdfInternal(
        supabase,
        s.organization_id,
        s.report_type
      );

      const results = await Promise.all(
        recipients.map((recipient) =>
          sendEmail({
            to: recipient,
            subject: `${s.name} - Scheduled Report (${fileName})`,
            html: `<p>Your scheduled report "<strong>${s.name}</strong>" is ready.</p><p>Report type: <em>${s.report_type.replace(/_/g, " ")}</em></p><p>File: ${fileName}</p><p>This is an automated delivery from your Gym Management Platform.</p>`,
          })
        )
      );

      if (results.some((r) => r.sent)) sent++;

      await updateNextRun(supabase, s.id, s.frequency, s.day_of_week, s.day_of_month);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Unknown error delivering schedule");
    }
  }

  return NextResponse.json({ processed, sent, errors });
}

async function updateNextRun(
  client: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  scheduleId: string,
  frequency: "daily" | "weekly" | "monthly",
  dayOfWeek: number | null,
  dayOfMonth: number | null
) {
  const now = new Date();
  const nextScheduledAt = calculateNextScheduledAt(frequency, dayOfWeek ?? undefined, dayOfMonth ?? undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from("report_schedules")
    .update({
      last_sent_at: now.toISOString(),
      next_scheduled_at: nextScheduledAt,
    })
    .eq("id", scheduleId);
}
