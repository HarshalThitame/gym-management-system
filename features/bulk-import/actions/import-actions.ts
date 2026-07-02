"use server";

import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  importMembers,
  importLeads,
  importEquipment,
  parseCsv,
  validateCsvStructure,
  type ImportResult
} from "../services/import-service";

export async function importMembersAction(csvContent: string): Promise<ImportResult> {
  const scope = await requireGymAdminScope("/admin");
  
  const result = await importMembers(
    csvContent,
    scope.scopedOrganizationId!,
    scope.gymId!,
    scope.userId
  );
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "import.members",
    entityType: "members",
    metadata: {
      total: result.total,
      imported: result.imported,
      failed: result.failed
    }
  });
  
  return result;
}

export async function importLeadsAction(csvContent: string): Promise<ImportResult> {
  const scope = await requireGymAdminScope("/admin");
  
  const result = await importLeads(
    csvContent,
    scope.scopedOrganizationId!,
    scope.gymId!,
    scope.userId
  );
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "import.leads",
    entityType: "crm_leads",
    metadata: {
      total: result.total,
      imported: result.imported,
      failed: result.failed
    }
  });
  
  return result;
}

export async function importEquipmentAction(csvContent: string): Promise<ImportResult> {
  const scope = await requireGymAdminScope("/admin");
  
  const result = await importEquipment(
    csvContent,
    scope.scopedOrganizationId!,
    scope.gymId!,
    scope.userId
  );
  
  await writeAuditLog({
    actorId: scope.userId,
    action: "import.equipment",
    entityType: "equipment",
    metadata: {
      total: result.total,
      imported: result.imported,
      failed: result.failed
    }
  });
  
  return result;
}

export async function validateCsvAction(csvContent: string, entityType: string) {
  await requireGymAdminScope("/admin");
  
  const requiredFieldsMap: Record<string, string[]> = {
    members: ["full_name", "email"],
    crm_leads: ["full_name", "email"],
    equipment: ["name", "category"]
  };
  
  const requiredFields = requiredFieldsMap[entityType] || [];
  return validateCsvStructure(csvContent, requiredFields);
}

export async function previewCsvAction(csvContent: string) {
  await requireGymAdminScope("/admin");
  
  const data = parseCsv(csvContent);
  return {
    total: data.length,
    preview: data.slice(0, 5),
    headers: data.length > 0 ? Object.keys(data[0]) : []
  };
}
