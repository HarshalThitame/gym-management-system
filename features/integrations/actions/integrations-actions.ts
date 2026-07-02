"use server";

import { revalidatePath } from "next/cache";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  updateIntegrationConfig,
  getIntegrationLogs,
} from "../services/integrations-service";

export async function getIntegrationsAction() {
  const scope = await requireGymAdminScope("/admin/integrations");
  return getIntegrations(scope.scopedOrganizationId ?? scope.organizationId);
}

export async function connectIntegrationAction(formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/integrations");
  const provider = formData.get("provider") as string;
  const label = formData.get("label") as string;
  const apiKey = formData.get("apiKey") as string;

  if (!provider) return;

  try {
    await connectIntegration({
      organization_id: scope.scopedOrganizationId ?? scope.organizationId,
      provider,
      label: label || provider,
      credentials: apiKey ? { api_key: apiKey } : {},
      created_by: scope.userId,
    });
    await writeAuditLog({ actorId: scope.userId, action: "integration.connected", entityType: "integration", metadata: { provider } });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/integrations");
}

export async function disconnectIntegrationAction(id: string): Promise<void> {
  const scope = await requireGymAdminScope("/admin/integrations");

  try {
    await disconnectIntegration(id);
    await writeAuditLog({ actorId: scope.userId, action: "integration.disconnected", entityType: "integration", entityId: id });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/integrations");
}

export async function getIntegrationLogsAction(integrationId: string) {
  await requireGymAdminScope("/admin/integrations");
  return getIntegrationLogs(integrationId);
}
