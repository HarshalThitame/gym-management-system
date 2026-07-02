"use server";

import {
  getAuditLogs,
  getAuditLogStats,
  getAuditLogById,
  getEntityAuditLogs,
  getDistinctActions,
  getDistinctEntityTypes,
  exportAuditLogsCsv,
  type AuditLogFilters
} from "../services/audit-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";

export async function getAuditLogsAction(
  filters: AuditLogFilters = {},
  page: number = 1,
  pageSize: number = 50
) {
  const scope = await requireGymAdminScope("/admin/audit");
  const gymId = scope.gymId;

  return getAuditLogs({ ...filters, gymId }, page, pageSize);
}

export async function getAuditStatsAction() {
  const scope = await requireGymAdminScope("/admin/audit");
  return getAuditLogStats(undefined, scope.gymId ?? undefined);
}

export async function getAuditLogDetailAction(id: string) {
  await requireGymAdminScope("/admin/audit");
  return getAuditLogById(id);
}

export async function getEntityAuditLogsAction(entityType: string, entityId: string) {
  await requireGymAdminScope("/admin/audit");
  return getEntityAuditLogs(entityType, entityId);
}

export async function getAuditFilterOptionsAction() {
  await requireGymAdminScope("/admin/audit");
  const [actions, entityTypes] = await Promise.all([
    getDistinctActions(),
    getDistinctEntityTypes()
  ]);
  return { actions, entityTypes };
}

export async function exportAuditLogsCsvAction(filters: AuditLogFilters = {}): Promise<string> {
  const scope = await requireGymAdminScope("/admin/audit");

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    action: "audit.export",
    entityType: "audit_log",
    metadata: { filters }
  });

  return exportAuditLogsCsv({ ...filters, gymId: scope.gymId ?? undefined });
}
