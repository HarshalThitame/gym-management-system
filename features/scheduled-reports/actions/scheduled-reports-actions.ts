"use server";

import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  getScheduledReports,
  getScheduledReport,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  getScheduledReportRuns,
  runScheduledReportNow,
  type ScheduledReport
} from "../services/scheduled-reports-service";
import type { ExportFormat } from "@/features/advanced-export/services/export-service";

export async function getScheduledReportsAction() {
  const scope = await requireGymAdminScope("/admin");
  return getScheduledReports(scope.scopedOrganizationId ?? undefined, scope.gymId ?? undefined);
}

export async function getScheduledReportAction(reportId: string) {
  await requireGymAdminScope("/admin");
  return getScheduledReport(reportId);
}

export async function createScheduledReportAction(params: {
  name: string;
  description?: string;
  reportType: string;
  scheduleType: "daily" | "weekly" | "monthly" | "custom";
  scheduleConfig: Record<string, any>;
  format: ExportFormat;
  recipients: string[];
  filters?: Record<string, any>;
  columns?: string[];
}) {
  const scope = await requireGymAdminScope("/admin");
  
  const report = await createScheduledReport({
    ...params,
    organizationId: scope.scopedOrganizationId ?? undefined,
    gymId: scope.gymId ?? undefined,
    createdBy: scope.userId
  });
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "scheduled_report.create",
    entityType: "scheduled_reports",
    entityId: report.id,
    metadata: { name: params.name }
  });
  
  return report;
}

export async function updateScheduledReportAction(reportId: string, updates: Partial<ScheduledReport>) {
  const scope = await requireGymAdminScope("/admin");
  await updateScheduledReport(reportId, updates);
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "scheduled_report.update",
    entityType: "scheduled_reports",
    entityId: reportId
  });
}

export async function deleteScheduledReportAction(reportId: string) {
  const scope = await requireGymAdminScope("/admin");
  await deleteScheduledReport(reportId);
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "scheduled_report.delete",
    entityType: "scheduled_reports",
    entityId: reportId
  });
}

export async function getScheduledReportRunsAction(reportId: string) {
  await requireGymAdminScope("/admin");
  return getScheduledReportRuns(reportId);
}

export async function runScheduledReportNowAction(reportId: string) {
  const scope = await requireGymAdminScope("/admin");
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "scheduled_report.run_now",
    entityType: "scheduled_reports",
    entityId: reportId
  });
  
  return runScheduledReportNow(reportId);
}

export async function toggleScheduledReportAction(reportId: string, isActive: boolean) {
  const scope = await requireGymAdminScope("/admin");
  await updateScheduledReport(reportId, { is_active: isActive });
  
  await writeAuditLog({
    actorId: scope.userId,
    action: isActive ? "scheduled_report.enable" : "scheduled_report.disable",
    entityType: "scheduled_reports",
    entityId: reportId
  });
}
