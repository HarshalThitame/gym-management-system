"use server";

import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { exportData, type ExportConfig, type ExportFormat } from "../services/export-service";

export async function exportDataAction(config: {
  entityType: string;
  format: ExportFormat;
  filters?: Record<string, any>;
  columns?: string[];
}) {
  const scope = await requireGymAdminScope("/admin");
  
  const exportConfig: ExportConfig = {
    ...config,
    organizationId: scope.scopedOrganizationId,
    gymId: scope.gymId
  };
  
  const result = await exportData(exportConfig);
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "export.data",
    entityType: config.entityType,
    metadata: { 
      format: config.format,
      filters: config.filters
    }
  });
  
  return result;
}

export async function exportMembersAction(format: ExportFormat = "csv") {
  return exportDataAction({
    entityType: "members",
    format
  });
}

export async function exportLeadsAction(format: ExportFormat = "csv") {
  return exportDataAction({
    entityType: "crm_leads",
    format
  });
}

export async function exportEquipmentAction(format: ExportFormat = "csv") {
  return exportDataAction({
    entityType: "equipment",
    format
  });
}

export async function exportPaymentsAction(format: ExportFormat = "csv", filters?: Record<string, any>) {
  return exportDataAction({
    entityType: "payments",
    format,
    filters
  });
}

export async function exportAttendanceAction(format: ExportFormat = "csv", filters?: Record<string, any>) {
  return exportDataAction({
    entityType: "attendance_sessions",
    format,
    filters
  });
}
