import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffFilters = {
  query: string;
  role: string;
  status: string;
  gymId: string;
  page: number;
  pageSize: number;
};

export type StaffMember = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  roleName: string;
  branchId: string | null;
  status: string;
};

export type StaffManagementData = {
  staff: StaffMember[];
  total: number;
  totalPages: number;
  gymAdmins: number;
  receptionStaff: number;
  otherStaff: number;
};

export async function getStaffManagementData(organizationId: string, filters: StaffFilters): Promise<StaffManagementData> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("branch_users")
    .select("id, user_id, role_name, branch_id, status, updated_at, profiles!inner(full_name, email)", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.role !== "all") {
    query = query.eq("role_name", filters.role as never);
  }
  if (filters.status !== "all") {
    query = query.eq("status", filters.status as never);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const result = await query.order("updated_at", { ascending: false }).range(from, from + filters.pageSize - 1);

  const rawData = result.data as unknown as Array<Record<string, unknown>>;
  const staff: StaffMember[] = (rawData ?? []).map((bu) => {
    const profile = bu.profiles as { full_name: string | null; email: string | null } | null;
    return {
      id: bu.id as string,
      userId: bu.user_id as string,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      roleName: bu.role_name as string,
      branchId: bu.branch_id as string | null,
      status: bu.status as string
    };
  });

  const { data: allUsers } = await supabase.from("branch_users").select("role_name").eq("organization_id", organizationId);

  return {
    staff,
    total: result.count ?? 0,
    totalPages: Math.ceil((result.count ?? 0) / filters.pageSize),
    gymAdmins: (allUsers ?? []).filter((u) => u.role_name === "gym_admin").length,
    receptionStaff: (allUsers ?? []).filter((u) => u.role_name === "reception_staff").length,
    otherStaff: (allUsers ?? []).filter((u) => !["gym_admin", "reception_staff"].includes(u.role_name)).length
  };
}
