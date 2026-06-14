import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrgUsage } from "./subscription-usage-types";
export type { OrgUsage, UsageWarning } from "./subscription-usage-types";

type SbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function getOrgUsage(organizationId: string): Promise<OrgUsage | null> {
  const supabase = await createSupabaseServerClient();

  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("package_id")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"])
    .maybeSingle();

  if (!sub) return null;

  const packageId = (sub as unknown as { package_id: string }).package_id;

  // Fetch limits from new package_limits table (single source of truth)
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      };
    };
  };

  const { data: limits } = await s
    .from("package_limits")
    .select("limit_code, value")
    .eq("package_id", packageId);

  const limitMap = new Map<string, number>();
  for (const l of (limits ?? [])) {
    limitMap.set(l.limit_code as string, l.value as number);
  }

  const memberLimit = limitMap.get("max_members") ?? 0;
  const branchLimit = limitMap.get("max_branches") ?? 0;
  const gymLimit = limitMap.get("max_gyms") ?? 0;
  const trainerLimit = limitMap.get("max_trainers") ?? 0;
  const storageLimit = limitMap.get("max_storage_gb") ?? 0;
  const apiCallLimit = limitMap.get("max_api_calls") ?? 0;

  const [memberCount, branchCount] = await Promise.all([
    getMemberCount(supabase, organizationId),
    getBranchCount(supabase, organizationId),
  ]);

  return {
    memberCount,
    branchCount,
    memberLimit,
    branchLimit,
    gymLimit,
    trainerLimit,
    storageLimit,
    apiCallLimit,
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
