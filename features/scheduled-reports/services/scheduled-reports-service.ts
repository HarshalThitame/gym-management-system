import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportData, type ExportFormat } from "@/features/advanced-export/services/export-service";
import { sendEmail } from "@/services/email/resend";

export type ScheduledReport = {
  id: string;
  organization_id: string | null;
  gym_id: string | null;
  name: string;
  description: string | null;
  report_type: string;
  schedule_type: "daily" | "weekly" | "monthly" | "custom";
  schedule_config: Record<string, any>;
  format: ExportFormat;
  recipients: string[];
  filters: Record<string, any> | null;
  columns: string[] | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduledReportRun = {
  id: string;
  report_id: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  records_count: number;
  file_url: string | null;
  error_message: string | null;
  created_at: string;
};

export async function getScheduledReports(organizationId?: string, gymId?: string): Promise<ScheduledReport[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("scheduled_reports")
    .select()
    .order("created_at", { ascending: false });

  if (organizationId) query = query.eq("organization_id", organizationId);
  if (gymId) query = query.eq("gym_id", gymId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getScheduledReport(reportId: string): Promise<ScheduledReport | null> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("scheduled_reports")
    .select()
    .eq("id", reportId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function createScheduledReport(params: {
  organizationId?: string;
  gymId?: string;
  name: string;
  description?: string;
  reportType: string;
  scheduleType: "daily" | "weekly" | "monthly" | "custom";
  scheduleConfig: Record<string, any>;
  format: ExportFormat;
  recipients: string[];
  filters?: Record<string, any>;
  columns?: string[];
  createdBy: string;
}): Promise<ScheduledReport> {
  const supabase = getSupabaseAdminClient();
  
  // Calculate next run time
  const nextRunAt = calculateNextRun(params.scheduleType, params.scheduleConfig);

  const { data, error } = await supabase
    .from("scheduled_reports")
    .insert({
      organization_id: params.organizationId,
      gym_id: params.gymId,
      name: params.name,
      description: params.description,
      report_type: params.reportType,
      schedule_type: params.scheduleType,
      schedule_config: params.scheduleConfig,
      format: params.format,
      recipients: params.recipients,
      filters: params.filters ?? {},
      columns: params.columns,
      is_active: true,
      next_run_at: nextRunAt.toISOString(),
      created_by: params.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScheduledReport(reportId: string, updates: Partial<ScheduledReport>): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const { error } = await supabase
    .from("scheduled_reports")
    .update(updates)
    .eq("id", reportId);

  if (error) throw error;
}

export async function deleteScheduledReport(reportId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const { error } = await supabase
    .from("scheduled_reports")
    .delete()
    .eq("id", reportId);

  if (error) throw error;
}

export async function getScheduledReportRuns(reportId: string): Promise<ScheduledReportRun[]> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("scheduled_report_runs")
    .select()
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function runScheduledReportNow(reportId: string): Promise<ScheduledReportRun> {
  const supabase = getSupabaseAdminClient();
  
  // Get report details
  const { data: report, error: reportError } = await supabase
    .from("scheduled_reports")
    .select()
    .eq("id", reportId)
    .single();

  if (reportError || !report) throw new Error("Report not found");

  // Create run record
  const { data: run, error: runError } = await supabase
    .from("scheduled_report_runs")
    .insert({
      report_id: reportId,
      status: "running",
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (runError) throw runError;

  try {
    // Generate report
    const exportResult = await exportData({
      entityType: report.report_type,
      format: report.format,
      filters: report.filters ?? undefined,
      columns: report.columns ?? undefined,
      organizationId: report.organization_id ?? undefined,
      gymId: report.gym_id ?? undefined
    });

    // In a real implementation, upload to storage and get URL
    // For now, we'll just mark as completed
    await supabase
      .from("scheduled_report_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_count: exportResult.data ? (exportResult.data as string).split("\n").length - 1 : 0
      })
      .eq("id", run.id);

    // Update last run and next run
    const nextRunAt = calculateNextRun(report.schedule_type, report.schedule_config);
    await supabase
      .from("scheduled_reports")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt.toISOString()
      })
      .eq("id", reportId);

    // Send email to recipients
    if (report.recipients.length > 0) {
      await sendReportEmail(report, exportResult);
    }

    return { ...run, status: "completed", completed_at: new Date().toISOString() };
  } catch (error) {
    await supabase
      .from("scheduled_report_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown error"
      })
      .eq("id", run.id);

    throw error;
  }
}

async function sendReportEmail(report: ScheduledReport, exportResult: { data: string | Uint8Array; filename: string; mimeType: string }) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${report.name}</h2>
      <p>Your scheduled report is ready.</p>
      <p><strong>Report Type:</strong> ${report.report_type}</p>
      <p><strong>Format:</strong> ${report.format}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      <p style="margin-top: 20px; color: #666; font-size: 14px;">
        This is an automated email from your gym management system.
      </p>
    </div>
  `;

  for (const recipient of report.recipients) {
    await sendEmail({
      to: recipient,
      subject: `Scheduled Report: ${report.name}`,
      html
    });
  }
}

function calculateNextRun(scheduleType: string, scheduleConfig: Record<string, any>): Date {
  const now = new Date();
  
  switch (scheduleType) {
    case "daily": {
      const time = scheduleConfig.time || "09:00";
      const [hours, minutes] = time.split(":").map(Number);
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }
    case "weekly": {
      const day = scheduleConfig.day || 1; // Monday
      const time = scheduleConfig.time || "09:00";
      const [hours, minutes] = time.split(":").map(Number);
      const next = new Date(now);
      next.setDate(now.getDate() + ((7 - now.getDay() + day) % 7 || 7));
      next.setHours(hours, minutes, 0, 0);
      return next;
    }
    case "monthly": {
      const day = scheduleConfig.day || 1;
      const time = scheduleConfig.time || "09:00";
      const [hours, minutes] = time.split(":").map(Number);
      const next = new Date(now.getFullYear(), now.getMonth(), day, hours, minutes);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next;
    }
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export async function getDueScheduledReports(): Promise<ScheduledReport[]> {
  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from("scheduled_reports")
    .select()
    .eq("is_active", true)
    .lte("next_run_at", new Date().toISOString());

  if (error) throw error;
  return data ?? [];
}
