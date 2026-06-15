import { getSupabaseClient } from "@/api/supabase";
import type { Gym, Branch, BranchUser, Member, Trainer } from "@/types";

export const adminGymService = {
  async getGyms(orgId: string): Promise<Gym[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("gyms").select("*").eq("organization_id", orgId).order("name");
    return (data ?? []) as Gym[];
  },

  async getGym(gymId: string): Promise<Gym | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("gyms").select("*").eq("id", gymId).maybeSingle();
    return data as Gym | null;
  },

  async getBranches(gymId: string): Promise<Branch[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("branches").select("*").eq("gym_id", gymId).order("name");
    return (data ?? []) as Branch[];
  },

  async getOrgBranches(orgId: string): Promise<Branch[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("branches").select("*").eq("organization_id", orgId).order("name");
    return (data ?? []) as Branch[];
  },

  async getGymMembers(gymId: string, limit = 50): Promise<Member[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("members").select("*").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []) as Member[];
  },

  async getGymTrainers(gymId: string): Promise<Trainer[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("trainers").select("*").eq("gym_id", gymId).order("display_name");
    return (data ?? []) as Trainer[];
  },

  async getGymStaff(gymId: string): Promise<BranchUser[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("branch_users").select("*").eq("gym_id", gymId).neq("role_name", "member").neq("role_name", "trainer");
    return (data ?? []) as BranchUser[];
  },

  async getGymDashboard(gymId: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    totalTrainers: number;
    totalStaff: number;
    todayCheckIns: number;
    monthlyRevenue: number;
    activeMemberships: number;
    expiringThisWeek: number;
  }> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const todayStart = now.toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      members,
      active,
      trainers,
      staff,
      attendance,
      revenue,
      activeM,
      expiring,
    ] = await Promise.all([
      supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "active"),
      supabase.from("trainers").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
      supabase.from("branch_users").select("id", { count: "exact", head: true }).eq("gym_id", gymId).neq("role_name", "member"),
      supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("check_in_at", todayStart),
      supabase.from("payments").select("amount").eq("gym_id", gymId).eq("status", "paid").gte("created_at", monthStart),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "active"),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "active").lte("end_date", weekEnd),
    ]);

    const monthlyRevenue = (revenue.data ?? []).reduce((sum: number, p: { amount: number }) => sum + (p.amount ?? 0), 0);

    return {
      totalMembers: members.count ?? 0,
      activeMembers: active.count ?? 0,
      totalTrainers: trainers.count ?? 0,
      totalStaff: staff.count ?? 0,
      todayCheckIns: attendance.count ?? 0,
      monthlyRevenue,
      activeMemberships: activeM.count ?? 0,
      expiringThisWeek: expiring.count ?? 0,
    };
  },
};
