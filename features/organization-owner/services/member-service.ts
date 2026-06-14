import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export type MemberFilters = {
  query: string;
  status: string;
  gymId: string;
  page: number;
  pageSize: number;
};

export type MemberManagementData = {
  members: MemberRow[];
  total: number;
  totalPages: number;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
};

export async function getMemberManagementData(organizationId: string, filters: MemberFilters): Promise<MemberManagementData> {
  const supabase = await createSupabaseServerClient();

  const gymIdsResult = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = (gymIdsResult.data ?? []).map((g) => g.id);

  if (gymIds.length === 0) {
    return { members: [], total: 0, totalPages: 0, totalMembers: 0, activeMembers: 0, inactiveMembers: 0 };
  }

  const targetGymIds = filters.gymId !== "all" ? [filters.gymId] : gymIds;

  let query = supabase
    .from("members")
    .select("*", { count: "exact" })
    .in("gym_id", targetGymIds);

  if (filters.status !== "all") {
    query = query.eq("status", filters.status as "active" | "inactive" | "archived");
  }

  if (filters.query) {
    query = query.or(`full_name.ilike.%${filters.query}%,phone.ilike.%${filters.query}%,email.ilike.%${filters.query}%`);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const { data: members, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + filters.pageSize - 1);

  if (error) throw new Error(error.message);

  const { data: allMembers } = await supabase
    .from("members")
    .select("status")
    .in("gym_id", gymIds);

  const totalPages = count ? Math.ceil(count / filters.pageSize) : 0;

  return {
    members: members ?? [],
    total: count ?? 0,
    totalPages,
    totalMembers: (allMembers ?? []).length,
    activeMembers: (allMembers ?? []).filter((m) => m.status === "active").length,
    inactiveMembers: (allMembers ?? []).filter((m) => m.status === "inactive" || m.status === "archived").length
  };
}
