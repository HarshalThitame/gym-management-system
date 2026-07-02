"use server";

import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  getCustomReports,
  getCustomReport,
  createCustomReport,
  updateCustomReport,
  deleteCustomReport,
  executeCustomReport,
  getReportTemplates,
  getEntityColumns,
  createReportFromTemplate,
  type CustomReport
} from "../services/custom-reports-service";

export async function getCustomReportsAction() {
  const scope = await requireGymAdminScope("/admin");
  return getCustomReports(
    scope.scopedOrganizationId ?? undefined,
    scope.gymId ?? undefined,
    scope.userId
  );
}

export async function getCustomReportAction(reportId: string) {
  await requireGymAdminScope("/admin");
  return getCustomReport(reportId);
}

export async function createCustomReportAction(params: {
  name: string;
  description?: string;
  entityType: string;
  columns: string[];
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limitCount?: number;
  isPublic?: boolean;
}) {
  const scope = await requireGymAdminScope("/admin");
  
  const report = await createCustomReport({
    ...params,
    organizationId: scope.scopedOrganizationId ?? undefined,
    gymId: scope.gymId ?? undefined,
    createdBy: scope.userId
  });
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "custom_report.create",
    entityType: "custom_reports",
    entityId: report.id,
    metadata: { name: params.name }
  });
  
  return report;
}

export async function updateCustomReportAction(reportId: string, updates: Partial<CustomReport>) {
  const scope = await requireGymAdminScope("/admin");
  await updateCustomReport(reportId, updates);
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "custom_report.update",
    entityType: "custom_reports",
    entityId: reportId
  });
}

export async function deleteCustomReportAction(reportId: string) {
  const scope = await requireGymAdminScope("/admin");
  await deleteCustomReport(reportId);
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "custom_report.delete",
    entityType: "custom_reports",
    entityId: reportId
  });
}

export async function executeCustomReportAction(reportId: string) {
  await requireGymAdminScope("/admin");
  return executeCustomReport(reportId);
}

export async function getReportTemplatesAction(category?: string) {
  await requireGymAdminScope("/admin");
  return getReportTemplates(category);
}

export async function getEntityColumnsAction(entityType: string) {
  await requireGymAdminScope("/admin");
  return getEntityColumns(entityType);
}

export async function createReportFromTemplateAction(templateId: string, name?: string) {
  const scope = await requireGymAdminScope("/admin");
  
  const report = await createReportFromTemplate(templateId, {
    organizationId: scope.scopedOrganizationId ?? undefined,
    gymId: scope.gymId ?? undefined,
    name,
    createdBy: scope.userId
  });
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "custom_report.create_from_template",
    entityType: "custom_reports",
    entityId: report.id,
    metadata: { templateId }
  });
  
  return report;
}
