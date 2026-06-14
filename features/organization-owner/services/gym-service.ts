import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type GymRow = Database["public"]["Tables"]["gyms"]["Row"];

export type GymFilters = {
  query: string;
  status: string;
  page: number;
  pageSize: number;
};

export type GymManagementData = {
  gyms: GymRow[];
  total: number;
  totalPages: number;
  activeGyms: number;
  suspendedGyms: number;
};

export async function getGymManagementData(organizationId: string, filters: GymFilters): Promise<GymManagementData> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("gyms")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.status !== "all") {
    query = query.eq("status", filters.status as "active" | "suspended" | "archived");
  }

  if (filters.query) {
    query = query.or(`name.ilike.%${filters.query}%,slug.ilike.%${filters.query}%`);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const { data: gyms, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + filters.pageSize - 1);

  if (error) throw new Error(error.message);

  const { data: allGyms } = await supabase
    .from("gyms")
    .select("status")
    .eq("organization_id", organizationId);

  const totalPages = count ? Math.ceil(count / filters.pageSize) : 0;

  return {
    gyms: gyms ?? [],
    total: count ?? 0,
    totalPages,
    activeGyms: (allGyms ?? []).filter((g) => g.status === "active").length,
    suspendedGyms: (allGyms ?? []).filter((g) => g.status === "suspended").length
  };
}

export async function getGymById(organizationId: string, gymId: string): Promise<GymRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("gyms")
    .select("*")
    .eq("id", gymId)
    .eq("organization_id", organizationId)
    .single();

  return data;
}

export async function getBranchesForGym(organizationId: string, gymId: string) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("branches")
    .select("*")
    .eq("gym_id", gymId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return data ?? [];
}
