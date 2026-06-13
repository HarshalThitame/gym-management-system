import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { getRolesData } from "@/features/super-admin/services/role-management-service";
import { getSuperAdminModule } from "@/features/super-admin/lib/super-admin-modules";
import { RoleManagementWorkspace } from "@/features/super-admin/components/roles/RoleManagementWorkspace";
import type { RoleManagementFilters } from "@/features/super-admin/services/role-management-service";

export async function generateMetadata(): Promise<Metadata> {
  const mod = getSuperAdminModule("roles");
  return { title: mod?.title ?? "Roles & Permissions" };
}

function stringParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function numberParam(value: string | string[] | undefined, fallback: number): number {
  const s = stringParam(value);
  if (!s) return fallback;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function SuperAdminRolesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["super_admin"], "/super-admin/roles");
  const criticalSuperAdminEmail = getCriticalSuperAdminEmail();
  const sp = await props.searchParams;

  const query = stringParam(sp.q) ?? "";
  const roleType = (stringParam(sp.type) ?? "all") as "all" | "system" | "custom";
  const sort = (stringParam(sp.sort) ?? "created_desc") as RoleManagementFilters["sort"];
  const page = numberParam(sp.page, 1);
  const pageSize = numberParam(sp.pageSize, 50);

  const data = await getRolesData({ query, roleType, sort, page, pageSize });

  if (page > data.totalPages) {
    const { redirect } = await import("next/navigation");
    redirect(`/super-admin/roles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0]! : v ?? ""])), page: String(data.totalPages) }).toString()}`);
  }

  return (
    <RoleManagementWorkspace
      criticalSuperAdminEmail={criticalSuperAdminEmail}
      data={data}
    />
  );
}
