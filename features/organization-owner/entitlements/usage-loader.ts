"use server";

import { getOrganizationUsage } from "@/features/entitlement";

export type LiveUsageData = {
  branches: number;
  members: number;
  trainers: number;
  staff: number;
};

export async function getLiveUsageAction(organizationId: string): Promise<LiveUsageData> {
  const usage = await getOrganizationUsage(organizationId);
  return {
    branches: usage.max_branches ?? 0,
    members: usage.max_members ?? 0,
    trainers: usage.max_trainers ?? 0,
    staff: usage.max_staff ?? 0,
  };
}
