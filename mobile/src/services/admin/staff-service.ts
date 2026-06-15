import { getSupabaseClient } from "@/api/supabase";
import type { BranchUser, Trainer } from "@/types";

export const adminStaffService = {
  async getStaff(orgId: string): Promise<BranchUser[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("branch_users")
      .select("*, profiles!inner(full_name, email, phone)")
      .eq("organization_id", orgId)
      .neq("role_name", "member")
      .order("role_name", { ascending: true });

    return (data ?? []) as BranchUser[];
  },

  async getTrainers(gymId: string): Promise<Trainer[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("trainers").select("*").eq("gym_id", gymId).order("display_name");
    return (data ?? []) as Trainer[];
  },

  async inviteStaff(orgId: string, gymId: string, branchId: string, email: string, roleName: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("branch_users").insert({
      organization_id: orgId,
      gym_id: gymId,
      branch_id: branchId,
      role_name: roleName,
      status: "invited",
    });
    return !error;
  },

  async updateStaffStatus(branchUserId: string, status: "active" | "suspended" | "revoked"): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("branch_users").update({ status }).eq("id", branchUserId);
    return !error;
  },
};
