import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { getUserManagementData, getPendingInvites, normalizeUserManagementFilters, type UserSortOption } from "@/features/super-admin/services/user-management-service";
import { UserManagementWorkspace } from "@/features/super-admin/components/users/UserManagementWorkspace";

export const metadata: Metadata = createMetadata({
  title: "User Management",
  description: "Manage organization owners, gym admins, reception staff, trainers, and members across all tenants.",
  path: "/super-admin/users"
});

type SuperAdminUsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperAdminUsersPage({ searchParams }: SuperAdminUsersPageProps) {
  await requireRole(["super_admin"], "/super-admin/users");
  const query = searchParams ? await searchParams : {};

  const filters = normalizeUserManagementFilters({
    query: stringParam(query.q) ?? "",
    role: stringParam(query.role) ?? "all",
    status: stringParam(query.status) ?? "all",
    organizationId: stringParam(query.organizationId) ?? "all",
    sort: (stringParam(query.sort) ?? "created_desc") as UserSortOption,
    page: Number(stringParam(query.page) ?? 1),
    pageSize: Number(stringParam(query.pageSize) ?? 25)
  });

  const [data, pendingInvites] = await Promise.all([
    getUserManagementData(filters),
    getPendingInvites()
  ]);

  if (data.pagination.totalPages > 0 && data.pagination.page > data.pagination.totalPages) {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.role !== "all") params.set("role", filters.role);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.organizationId !== "all") params.set("organizationId", filters.organizationId);
    params.set("sort", filters.sort);
    params.set("page", String(data.pagination.totalPages));
    params.set("pageSize", String(filters.pageSize));
    redirect(`/super-admin/users?${params.toString()}`);
  }

  return (
    <UserManagementWorkspace
      criticalSuperAdminEmail={getCriticalSuperAdminEmail()}
      data={data}
      pendingInvites={pendingInvites}
    />
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
