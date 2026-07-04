import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEnterpriseDashboard } from "@/features/enterprise/services/enterprise-service";
import { SuperAdminModuleWorkspace } from "@/features/super-admin/components/super-admin-module-workspace";
import { getSuperAdminModule, superAdminModules } from "@/features/super-admin/lib/super-admin-modules";
import { getGymBranchManagementData, normalizeGymBranchFilters } from "@/features/super-admin/services/gym-branch-management-service";
import { getOrganizationManagementData, normalizeOrganizationFilters, type OrganizationSortOption } from "@/features/super-admin/services/organization-management-service";
import { getOptionalCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { createMetadata } from "@/lib/seo/metadata";

type SuperAdminModuleRouteProps = {
  params: Promise<{ module: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return superAdminModules
    .filter((m) => m.slug !== "domains" && m.slug !== "white-label" && m.slug !== "support" && m.slug !== "subscriptions" && m.slug !== "billing" && m.slug !== "approvals" && m.slug !== "analytics" && m.slug !== "monitoring" && m.slug !== "backups" && m.slug !== "ux-governance" && m.slug !== "production-safety")
    .map((module) => ({ module: module.slug }));
}

export async function generateMetadata({ params }: SuperAdminModuleRouteProps): Promise<Metadata> {
  const { module: slug } = await params;
  const selectedModule = getSuperAdminModule(slug);

  if (!selectedModule) {
    return createMetadata({
      title: "Super Admin Module",
      description: "Super Admin module for global SaaS platform governance.",
      path: "/super-admin"
    });
  }

  return createMetadata({
    title: selectedModule.title,
    description: selectedModule.description,
    path: selectedModule.href
  });
}

export default async function SuperAdminModuleRoute({ params, searchParams }: SuperAdminModuleRouteProps) {
  const { module: slug } = await params;
  const filters = searchParams ? await searchParams : {};
  const selectedModule = getSuperAdminModule(slug);

  if (!selectedModule) {
    notFound();
  }

  const dashboard = await getEnterpriseDashboard();
  const organizationManagement = selectedModule.slug === "organizations"
    ? await getOrganizationManagementData(dashboard, normalizeOrganizationFilters({
      query: stringParam(filters.q) ?? "",
      status: stringParam(filters.status) ?? "all",
      sort: (stringParam(filters.sort) ?? "created_desc") as OrganizationSortOption,
      page: Number(stringParam(filters.page) ?? 1),
      pageSize: Number(stringParam(filters.pageSize) ?? 12)
    }))
    : null;
  const gymBranchManagement = selectedModule.slug === "gyms"
    ? await getGymBranchManagementData(normalizeGymBranchFilters({
      query: stringParam(filters.q) ?? "",
      organizationId: stringParam(filters.organizationId) ?? "all",
      status: stringParam(filters.status) ?? "all",
      page: Number(stringParam(filters.page) ?? 1),
      pageSize: Number(stringParam(filters.pageSize) ?? 20)
    }))
    : null;

  return (
    <SuperAdminModuleWorkspace
      criticalSuperAdminEmail={getOptionalCriticalSuperAdminEmail() ?? ""}
      dashboard={dashboard}
      filters={filters}
      gymBranchManagement={gymBranchManagement}
      organizationManagement={organizationManagement}
      superModule={selectedModule}
    />
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
