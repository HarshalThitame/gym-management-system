import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrgUsage } from "./subscription-usage-types";
export type { OrgUsage, UsageWarning } from "./subscription-usage-types";

type SbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function getOrgUsage(organizationId: string): Promise<OrgUsage | null> {
  const supabase = await createSupabaseServerClient();

  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("package_id, packages!inner(max_members, max_branches)")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"])
    .maybeSingle();

  if (!sub) return null;

  const subRow = sub as unknown as { package_id: string; packages: { max_members: number; max_branches: number } };
  const memberLimit = subRow.packages.max_members;
  const branchLimit = subRow.packages.max_branches;

  const [memberCount, branchCount] = await Promise.all([
    getMemberCount(supabase, organizationId),
    getBranchCount(supabase, organizationId),
  ]);

  return {
    memberCount,
    branchCount,
    memberLimit,
    branchLimit,
    memberPercent: memberLimit === -1 ? 0 : Math.round((memberCount / memberLimit) * 100),
    branchPercent: branchLimit === -1 ? 0 : Math.round((branchCount / branchLimit) * 100),
    isOverMemberLimit: memberLimit !== -1 && memberCount >= memberLimit,
    isOverBranchLimit: branchLimit !== -1 && branchCount >= branchLimit,
  };
}

export { getUsageWarnings } from "./subscription-usage-types";

async function getMemberCount(supabase: SbClient, organizationId: string): Promise<number> {
  const { count } = await (supabase as never as { from(t: string): { select(c: string, o: { count: "exact"; head: true }): { eq(c: string, v: string): Promise<{ count: number | null }> } } })
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return count ?? 0;
}

async function getBranchCount(supabase: SbClient, organizationId: string): Promise<number> {
  const { count } = await supabase
    .from("gyms")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");

  return count ?? 0;
}
