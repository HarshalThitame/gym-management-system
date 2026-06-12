import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { getUserManagementData, normalizeUserManagementFilters, type UserSortOption } from "@/features/super-admin/services/user-management-service";
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

  const data = await getUserManagementData(normalizeUserManagementFilters({
    query: stringParam(query.q) ?? "",
    role: stringParam(query.role) ?? "all",
    status: stringParam(query.status) ?? "all",
    organizationId: stringParam(query.organizationId) ?? "all",
    sort: (stringParam(query.sort) ?? "created_desc") as UserSortOption,
    page: Number(stringParam(query.page) ?? 1),
    pageSize: Number(stringParam(query.pageSize) ?? 25)
  }));

  return (
    <UserManagementWorkspace
      criticalSuperAdminEmail={getCriticalSuperAdminEmail()}
      data={data}
    />
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
