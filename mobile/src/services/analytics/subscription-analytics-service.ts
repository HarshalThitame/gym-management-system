import { getSupabaseClient } from "@/api/supabase";

export interface SubscriptionAnalytics {
  planTier: string; status: string;
  membersUsed: number; memberLimit: number;
  branchesUsed: number; branchLimit: number;
  staffUsed: number; staffLimit: number;
  storageUsed: number; storageLimit: number;
  attendanceEnabled: boolean; crmEnabled: boolean; aiEnabled: boolean;
  usagePercent: number; needsUpgrade: boolean;
  recommendation: string | null;
}

export const subscriptionAnalyticsService = {
  async getSubscriptionAnalytics(orgId: string): Promise<SubscriptionAnalytics> {
    try {
    const supabase = getSupabaseClient();

    const { data: sub } = await supabase.from("platform_subscriptions").select("*").eq("organization_id", orgId).maybeSingle();
    const { data: config } = await supabase.from("tenant_configs").select("*").eq("organization_id", orgId).maybeSingle();

    const tier = (sub as any)?.plan_tier ?? (config as any)?.plan_tier ?? "Free";
    const memberCap = (sub as any)?.member_limit ?? 100;
    const branchCap = (sub as any)?.branch_limit ?? 1;
    const staffCap = (sub as any)?.staff_limit ?? 5;
    const storageCap = (sub as any)?.storage_limit_mb ?? 100;

    const [members, branches, staff] = await Promise.all([
      supabase.from("members").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
      supabase.from("branch_users").select("id", { count: "exact", head: true }).eq("organization_id", orgId).neq("role_name", "member"),
    ]);

    const memberCount = members.count ?? 0;
    const branchCount = branches.count ?? 0;
    const staffCount = staff.count ?? 0;
    const usagePercent = Math.round((memberCount / memberCap) * 100);
    const needsUpgrade = usagePercent > 80 || branchCount >= branchCap;

    let recommendation: string | null = null;
    if (usagePercent > 80) recommendation = `Member usage at ${usagePercent}%. Consider upgrading.`;
    else if (branchCount >= branchCap) recommendation = `Branch limit reached (${branchCount}/${branchCap}). Upgrade to add more.`;
    else if (staffCount >= staffCap) recommendation = `Staff limit at ${staffCount}/${staffCap}.`;
    else if (memberCount > memberCap * 0.6) recommendation = `Growing: ${memberCount}/${memberCap} members used.`;

    return {
      planTier: tier, status: (sub as any)?.status ?? "active",
      membersUsed: memberCount, memberLimit: memberCap,
      branchesUsed: branchCount, branchLimit: branchCap,
      staffUsed: staffCount, staffLimit: staffCap,
      storageUsed: 0, storageLimit: storageCap,
      attendanceEnabled: true, crmEnabled: true, aiEnabled: tier === "enterprise",
      usagePercent, needsUpgrade, recommendation,
    };
    } catch { return { planTier: "Free", status: "unknown", membersUsed: 0, memberLimit: 100, branchesUsed: 0, branchLimit: 1, staffUsed: 0, staffLimit: 5, storageUsed: 0, storageLimit: 100, attendanceEnabled: true, crmEnabled: true, aiEnabled: false, usagePercent: 0, needsUpgrade: false, recommendation: null }; }
  },
};
