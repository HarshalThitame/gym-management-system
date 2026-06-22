import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export type LeadFilters = {
  q: string | undefined;
  status: string | undefined;
  source: string | undefined;
  page: number | undefined;
  pageSize: number | undefined;
};

export type LeadServiceResult = {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getLeads(
  organizationId: string,
  filters: LeadFilters
): Promise<LeadServiceResult> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 12));

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("leads").select("*", { count: "exact" });

  if (gymIds.length > 0) {
    query = query.in("gym_id", gymIds);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }

  if (filters.q) {
    query = query.or(
      `name.ilike.%${filters.q}%,phone.ilike.%${filters.q}%,email.ilike.%${filters.q}%`
    );
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return {
    leads: (data ?? []) as LeadRow[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getNewLeadsCount(organizationId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("leads").select("id", { count: "exact" }).gte("created_at", startOfMonth);

  if (gymIds.length > 0) {
    query = query.in("gym_id", gymIds);
  }

  const { count } = await query;
  return count ?? 0;
}
