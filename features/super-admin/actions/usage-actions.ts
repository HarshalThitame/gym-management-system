"use server";

import { getOrgUsage } from "@/features/super-admin/services/subscription-usage-service";
export type { OrgUsage } from "@/features/super-admin/services/subscription-usage-service";

export async function getOrgUsageAction(organizationId: string) {
  return getOrgUsage(organizationId);
}
