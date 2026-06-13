import { createSupabaseServerClient } from "@/lib/supabase/server";

type RoleRow = { id: string; name: string; display_name: string; description: string; is_system: boolean; created_at: string };

export type PermissionEntry = {
  resource: string;
  actions: string[];
};

export type RoleManagementRecord = RoleRow & {
  is_system: boolean;
  userCount: number;
  permissionCount: number;
};

export type RoleManagementUser = {
  id: string;
  userRoleId: string;
  fullName: string;
  email: string | null;
  assignedAt: string;
};

export type RoleDetailData = RoleRow & {
  permissions: PermissionEntry[];
  users: RoleManagementUser[];
};

export type RoleManagementSummary = {
  totalRoles: number;
  systemRoles: number;
  customRoles: number;
  totalAssignments: number;
};

export type RoleManagementFilters = {
  query: string;
  roleType: "all" | "system" | "custom";
  sort: "name_asc" | "name_desc" | "created_desc" | "created_asc" | "users_desc";
  page: number;
  pageSize: number;
};

export type RoleManagementData = {
  roles: RoleManagementRecord[];
  summary: RoleManagementSummary;
  filters: RoleManagementFilters;
  totalPages: number;
};

function sanitizeSearch(query: string): string {
  return query.replaceAll(/[%_()\\]/g, "").trim();
}

type SupabaseClientType = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function fetchRolePermissionsCounts(supabase: SupabaseClientType, roleIds: string[]): Promise<Record<string, number>> {
  if (roleIds.length === 0) return {};
  const sb = supabase as never as { from: (t: string) => { select: (c: string) => { in: (c: string, v: string[]) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }> } } };
  const r = await sb.from("role_permissions").select("role_id").in("role_id", roleIds);
  if (r.error) throw new Error(String(r.error));
  const counts: Record<string, number> = {};
  for (const p of r.data ?? []) {
    const rid = p.role_id as string;
    counts[rid] = (counts[rid] ?? 0) + 1;
  }
  return counts;
}

export async function getRolesData(filters?: Partial<RoleManagementFilters>): Promise<RoleManagementData> {
  const supabase = await createSupabaseServerClient();
  const f: RoleManagementFilters = { query: "", roleType: "all", sort: "created_desc", page: 1, pageSize: 50, ...filters };

  let query = supabase.from("roles").select("*, user_roles:user_roles(count)", { count: "exact" });

  if (f.roleType === "system") { query = (query as never as { filter: (col: string, op: string, val: unknown) => typeof query }).filter("is_system", "eq", true); }
  else if (f.roleType === "custom") { query = (query as never as { filter: (col: string, op: string, val: unknown) => typeof query }).filter("is_system", "eq", false); }

  const sanitized = f.query ? sanitizeSearch(f.query) : "";
  if (sanitized) {
    query = query.or(`name.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  switch (f.sort) {
    case "name_asc": query = query.order("display_name", { ascending: true }); break;
    case "name_desc": query = query.order("display_name", { ascending: false }); break;
    case "created_asc": query = query.order("created_at", { ascending: true }); break;
    case "users_desc": query = query.order("name", { ascending: true }); break;
    default: query = query.order("created_at", { ascending: false });
  }

  const from = (f.page - 1) * f.pageSize;
  const to = from + f.pageSize - 1;
  const { data: roles, error, count } = await query.range(from, to);

  if (error) throw new Error(error.message);
  const raw = roles ?? [];

  const records: RoleManagementRecord[] = raw.map((r) => {
    const row = r as unknown as RoleRow & { user_roles: { count: number }[] };
    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      description: row.description,
      is_system: row.is_system,
      created_at: row.created_at,
      userCount: row.user_roles?.[0]?.count ?? 0,
      permissionCount: 0
    };
  });

  const permCounts = await fetchRolePermissionsCounts(supabase, records.map((r) => r.id));
  for (const rec of records) {
    rec.permissionCount = permCounts[rec.id] ?? 0;
  }

  const systemRoles = records.filter((r) => r.is_system).length;
  const totalAssignments = records.reduce((sum, r) => sum + r.userCount, 0);
  const totalItems = count ?? records.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / f.pageSize));

  return {
    roles: records,
    summary: { totalRoles: records.length, systemRoles, customRoles: records.length - systemRoles, totalAssignments },
    filters: f,
    totalPages
  };
}

export async function getRoleDetailData(roleId: string): Promise<RoleDetailData | null> {
  const supabase = await createSupabaseServerClient();

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .single();

  if (roleError) throw new Error(roleError.message);
  if (!role) return null;

  const sb = supabase as never as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }> } } };
  const permResult = await sb.from("role_permissions").select("resource, actions").eq("role_id", roleId);
  if (permResult.error) throw new Error(String(permResult.error));

  const { data: userRoles, error: urError } = await supabase
    .from("user_roles")
    .select("id, user_id, created_at, profile:profiles(id, full_name, email)")
    .eq("role_id", roleId)
    .order("created_at", { ascending: false });

  if (urError) throw new Error(urError.message);

  const users: RoleManagementUser[] = (userRoles ?? []).map((ur) => {
    const urow = ur as unknown as { id: string; user_id: string; created_at: string; profile: { id: string; full_name: string; email: string | null } | null };
    return {
      id: urow.user_id,
      userRoleId: urow.id,
      fullName: urow.profile?.full_name ?? "Unknown",
      email: urow.profile?.email ?? null,
      assignedAt: urow.created_at
    };
  });

  const row = role as unknown as RoleRow;

  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    is_system: row.is_system,
    created_at: row.created_at,
    permissions: (permResult.data ?? []).map((p) => ({ resource: p.resource as string, actions: p.actions as string[] })),
    users
  };
}

export async function createRoleInDb(name: string, displayName: string, description: string): Promise<RoleRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roles")
    .insert({ name, display_name: displayName, description, is_system: false } as never)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create role.");
  return data as unknown as RoleRow;
}

export async function updateRoleInDb(roleId: string, displayName: string, description: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: checkError } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .single();

  if (checkError) throw new Error(checkError.message);
  if ((existing as unknown as { is_system: boolean })?.is_system) throw new Error("System roles cannot be modified.");

  const { error } = await supabase
    .from("roles")
    .update({ display_name: displayName, description })
    .eq("id", roleId);

  if (error) throw new Error(error.message);
}

export async function deleteRoleFromDb(roleId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: checkError } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .single();

  if (checkError) throw new Error(checkError.message);
  if ((existing as unknown as { is_system: boolean })?.is_system) throw new Error("System roles cannot be deleted.");

  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId);

  if (error) throw new Error(error.message);
}

export async function updateRolePermissionsInDb(roleId: string, permissions: PermissionEntry[]): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const body = permissions.map((p) => ({ resource: p.resource, actions: p.actions }));

  const { error } = await (supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
    "update_role_permissions",
    { p_role_id: roleId, p_permissions: JSON.parse(JSON.stringify(body)) }
  );

  if (error) throw new Error(error.message);
}

export async function cloneRoleInDb(sourceRoleId: string, name: string, displayName: string, description: string): Promise<RoleRow> {
  const supabase = await createSupabaseServerClient();

  const { data: source, error: srcError } = await supabase
    .from("roles")
    .select("*")
    .eq("id", sourceRoleId)
    .single();

  if (srcError) throw new Error(srcError.message);
  if (!source) throw new Error("Source role not found.");

  const { data: newRole, error: createError } = await supabase
    .from("roles")
    .insert({ name, display_name: displayName, description, is_system: false } as never)
    .select("*")
    .single();

  if (createError || !newRole) throw new Error(createError?.message ?? "Failed to create cloned role.");

  const sb = supabase as never as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }> }; insert: (rows: Array<Record<string, unknown>>) => Promise<{ error: { message: string } | null }> } };
  const srcPerms = await sb.from("role_permissions").select("resource, actions").eq("role_id", sourceRoleId);
  if (srcPerms.error) throw new Error(String(srcPerms.error));

  const permsToInsert = (srcPerms.data ?? []).map((p) => ({
    role_id: (newRole as unknown as RoleRow).id,
    resource: p.resource as string,
    actions: p.actions as string[]
  }));

  if (permsToInsert.length > 0) {
    const { error: insError } = await sb.from("role_permissions").insert(permsToInsert);
    if (insError) throw new Error(insError.message);
  }

  return newRole as unknown as RoleRow;
}

export async function searchUsersByEmail(query: string): Promise<Array<{ id: string; fullName: string; email: string | null }>> {
  const supabase = await createSupabaseServerClient();
  const sanitized = sanitizeSearch(query);
  if (!sanitized) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", `%${sanitized}%`)
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name, email: p.email }));
}

export async function getAssignedRoleIds(userId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.role_id);
}
