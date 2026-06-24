"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess } from "@/features/entitlement";
import { sendEmail } from "@/services/email/resend";
import { generateReportPdfInternal, calculateNextScheduledAt, type ReportType } from "@/features/organization-owner/lib/report-schedule-utils";

export type ReportSchedule = {
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
  created_at: string;
  updated_at: string;
};

export type CreateReportScheduleInput = {
  name: string;
  reportType: ReportSchedule["report_type"];
  frequency: ReportSchedule["frequency"];
  dayOfWeek?: number;
  dayOfMonth?: number;
  recipients: string[];
  isActive?: boolean;
};

export async function getReportSchedules(organizationId: string): Promise<ReportSchedule[]> {
  await requireOrgFeatureAccess(organizationId, "scheduled_report_delivery");

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("report_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ReportSchedule[];
}

export async function createReportSchedule(
  organizationId: string,
  input: CreateReportScheduleInput
): Promise<ReportSchedule> {
  await requireOrgFeatureAccess(organizationId, "scheduled_report_delivery");

  const supabase = await createSupabaseServerClient();
  const nextScheduledAt = calculateNextScheduledAt(input.frequency, input.dayOfWeek, input.dayOfMonth);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("report_schedules")
    .insert({
      organization_id: organizationId,
      name: input.name,
      report_type: input.reportType,
      frequency: input.frequency,
      day_of_week: input.dayOfWeek ?? null,
      day_of_month: input.dayOfMonth ?? null,
      recipients: input.recipients,
      is_active: input.isActive ?? true,
      next_scheduled_at: nextScheduledAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ReportSchedule;
}

export async function updateReportSchedule(
  organizationId: string,
  scheduleId: string,
  input: Partial<CreateReportScheduleInput>
): Promise<ReportSchedule> {
  await requireOrgFeatureAccess(organizationId, "scheduled_report_delivery");

  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.reportType !== undefined) updateData.report_type = input.reportType;
  if (input.frequency !== undefined) updateData.frequency = input.frequency;
  if (input.dayOfWeek !== undefined) updateData.day_of_week = input.dayOfWeek;
  if (input.dayOfMonth !== undefined) updateData.day_of_month = input.dayOfMonth;
  if (input.recipients !== undefined) updateData.recipients = input.recipients;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  if (input.frequency) {
    updateData.next_scheduled_at = calculateNextScheduledAt(
      input.frequency,
      input.dayOfWeek,
      input.dayOfMonth
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("report_schedules")
    .update(updateData)
    .eq("id", scheduleId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ReportSchedule;
}

export async function deleteReportSchedule(
  organizationId: string,
  scheduleId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "scheduled_report_delivery");

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("report_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function generateReportPdf(
  organizationId: string,
  reportType: ReportType,
  dateFrom?: string,
  dateTo?: string
): Promise<{ pdfBuffer: Uint8Array; fileName: string }> {
  await requireOrgFeatureAccess(organizationId, "scheduled_report_delivery");

  const supabase = await createSupabaseServerClient();
  return generateReportPdfInternal(supabase, organizationId, reportType, dateFrom, dateTo);
}

export async function sendScheduledReport(
  organizationId: string,
  scheduleId: string
): Promise<{ sent: boolean; recipients: number; fileName: string }> {
  await requireOrgFeatureAccess(organizationId, "scheduled_report_delivery");

  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedule, error } = await (supabase as any)
    .from("report_schedules")
    .select("*")
    .eq("id", scheduleId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !schedule) throw new Error("Schedule not found");

  const sched = schedule as ReportSchedule;
  const { fileName } = await generateReportPdf(organizationId, sched.report_type);

  const recipients = sched.recipients ?? [];
  await Promise.all(
    recipients.map((recipient) =>
      sendEmail({
        to: recipient,
        subject: `${sched.name} - ${sched.report_type.replace(/_/g, " ")}`,
        html: `<p>Your scheduled report "${sched.name}" is attached as a PDF.</p><p>Report type: ${sched.report_type}</p>`,
      })
    )
  );

  const now = new Date();
  const nextScheduledAt = calculateNextScheduledAt(sched.frequency, sched.day_of_week ?? undefined, sched.day_of_month ?? undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("report_schedules")
    .update({
      last_sent_at: now.toISOString(),
      next_scheduled_at: nextScheduledAt,
    })
    .eq("id", scheduleId);

  return { sent: true, recipients: recipients.length, fileName };
}

export async function processScheduledReports(
  organizationId: string
): Promise<{ processed: number; sent: number; errors: string[] }> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedules, error } = await (supabase as any)
    .from("report_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .lte("next_scheduled_at", now.toISOString());

  if (error) return { processed: 0, sent: 0, errors: [error.message] };

  let sent = 0;
  const errors: string[] = [];

  for (const schedule of (schedules ?? []) as ReportSchedule[]) {
    try {
      if (!schedule.recipients?.length) continue;

      await generateReportPdf(organizationId, schedule.report_type);

      await Promise.all(
        schedule.recipients.map((recipient) =>
          sendEmail({
            to: recipient,
            subject: `${schedule.name} - Scheduled Report`,
            html: `<p>Your scheduled report "${schedule.name}" (${schedule.report_type}) is ready.</p>`,
          })
        )
      );

      const nextScheduledAt = calculateNextScheduledAt(
        schedule.frequency,
        schedule.day_of_week ?? undefined,
        schedule.day_of_month ?? undefined
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("report_schedules")
        .update({
          last_sent_at: now.toISOString(),
          next_scheduled_at: nextScheduledAt,
        })
        .eq("id", schedule.id);

      sent++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Unknown error");
    }
  }

  return { processed: (schedules ?? []).length, sent, errors };
}
