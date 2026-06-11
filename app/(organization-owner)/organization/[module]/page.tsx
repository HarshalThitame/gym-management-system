import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrganizationOwnerWorkspace } from "@/features/organization-owner/components/organization-owner-workspace";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrganizationOwnerModule, organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import { getOrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

type OrganizationOwnerModuleRouteProps = {
  params: Promise<{ module: string }>;
};

export function generateStaticParams() {
  return organizationOwnerModules.map((module) => ({ module: module.slug }));
}

export async function generateMetadata({ params }: OrganizationOwnerModuleRouteProps): Promise<Metadata> {
  const { module: slug } = await params;
  const selectedModule = getOrganizationOwnerModule(slug);

  if (!selectedModule) {
    return createMetadata({
      title: "Organization Owner Module",
      description: "Tenant-safe organization owner module.",
      path: "/organization"
    });
  }

  return createMetadata({
    title: selectedModule.title,
    description: selectedModule.description,
    path: selectedModule.href
  });
}

export default async function OrganizationOwnerModulePage({ params }: OrganizationOwnerModuleRouteProps) {
  const { module: slug } = await params;
  const selectedModule = getOrganizationOwnerModule(slug);

  if (!selectedModule) {
    notFound();
  }

  const context = await requireOrganizationOwner(selectedModule.href);
  const [dashboard, planContext] = await Promise.all([
    getOrganizationOwnerDashboard(context),
    getOrgPlanContext(context.organizationId)
  ]);

  return <OrganizationOwnerWorkspace dashboard={dashboard} module={selectedModule} planContext={planContext} />;
}
