import { getSupabaseClient } from "@/api/supabase";
import type { Branch } from "@/types";

export const branchService = {
  async getOrganizationBranches(organizationId: string): Promise<Branch[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("name", { ascending: true });

    return (data ?? []) as Branch[];
  },

  async getBranchById(branchId: string): Promise<Branch | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .maybeSingle();

    return data as Branch | null;
  },

  async getMemberBranches(memberId: string): Promise<Branch[]> {
    const supabase = getSupabaseClient();

    const { data: member } = await supabase
      .from("members")
      .select("organization_id")
      .eq("id", memberId)
      .maybeSingle();

    if (!member?.organization_id) return [];

    const { data: membership } = await supabase
      .from("memberships")
      .select("branch_id")
      .eq("member_id", memberId)
      .eq("status", "active")
      .maybeSingle();

    if (membership?.branch_id) {
      const branch = await this.getBranchById(membership.branch_id);
      return branch ? [branch] : [];
    }

    return this.getOrganizationBranches(member.organization_id);
  },
};
