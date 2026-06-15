import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { Organization, PlatformSubscription, TenantConfig } from "@/types";

export interface OrgDashboardData {
  organization: Organization | null;
  subscription: PlatformSubscription | null;
  tenantConfig: TenantConfig | null;
  totalGyms: number;
  totalBranches: number;
  totalMembers: number;
  totalStaff: number;
  totalTrainers: number;
  monthlyRevenue: number;
  todayAttendance: number;
  memberGrowth: number;
  activeMembers: number;
  expiringMembers: number;
}

export const adminOrganizationService = {
  async getOrganization(orgId: string): Promise<Organization | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
    return data as Organization | null;
  },

  async getDashboard(orgId: string): Promise<OrgDashboardData> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      org,
      sub,
      tenantConfig,
      gyms,
      branches,
      members,
      staff,
      trainers,
      revenue,
      attendance,
      activeMembers,
      expiring,
    ] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
      supabase.from("platform_subscriptions").select("*").eq("organization_id", orgId).maybeSingle(),
      supabase.from("tenant_configs").select("*").eq("organization_id", orgId).maybeSingle(),
      supabase.from("gyms").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("branch_users").select("id", { count: "exact", head: true }).eq("organization_id", orgId).neq("role_name", "member"),
      supabase.from("trainers").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("payments").select("amount").eq("organization_id", orgId).eq("status", "paid").gte("created_at", monthStart),
      supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("check_in_at", new Date().toISOString().split("T")[0]),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active").lte("end_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const monthlyRevenue = (revenue.data ?? []).reduce((sum: number, p: { amount: number }) => sum + (p.amount ?? 0), 0);

    return {
      organization: org.data as Organization | null,
      subscription: sub.data as PlatformSubscription | null,
      tenantConfig: tenantConfig.data as TenantConfig | null,
      totalGyms: gyms.count ?? 0,
      totalBranches: branches.count ?? 0,
      totalMembers: members.count ?? 0,
      totalStaff: staff.count ?? 0,
      totalTrainers: trainers.count ?? 0,
      monthlyRevenue,
      todayAttendance: attendance.count ?? 0,
      memberGrowth: 0,
      activeMembers: activeMembers.count ?? 0,
      expiringMembers: expiring.count ?? 0,
    };
  },

  async getSubscription(orgId: string): Promise<PlatformSubscription | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("platform_subscriptions").select("*").eq("organization_id", orgId).maybeSingle();
    return data as PlatformSubscription | null;
  },

  async getTenantConfig(orgId: string): Promise<TenantConfig | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("tenant_configs").select("*").eq("organization_id", orgId).maybeSingle();
    return data as TenantConfig | null;
  },
};
