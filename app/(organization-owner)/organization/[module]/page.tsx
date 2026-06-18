import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrganizationOwnerWorkspace } from "@/features/organization-owner/components/organization-owner-workspace";
import { getOrganizationOwnerModule, organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { resolveModuleData, type ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { MODULE_FEATURE_MAP, requireOrganizationFeatureAccess } from "@/features/entitlement";

type OrgOwnerModuleRouteProps = {
  params: Promise<{ module: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return organizationOwnerModules.map((m) => ({ module: m.slug }));
}

export async function generateMetadata({ params }: OrgOwnerModuleRouteProps): Promise<Metadata> {
  const { module: slug } = await params;
  const m = getOrganizationOwnerModule(slug);
  return createMetadata({ title: m?.title ?? "Organization Module", description: m?.description ?? "", path: m?.href ?? "/organization" });
}

function parseSearchParams(raw?: Record<string, string | string[] | undefined>): ModuleSearchParams {
  const get = (k: string) => (Array.isArray(raw?.[k]) ? (raw![k] as string[])[0] : (raw?.[k] as string | undefined));
  return {
    q: get("q"),
    status: get("status"),
    role: get("role"),
    gymId: get("gymId"),
    sort: get("sort"),
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
    page: get("page") ? Math.max(1, Number(get("page"))) : 1,
    pageSize: get("pageSize") ? Math.min(50, Math.max(5, Number(get("pageSize")))) : 12
  };
}

export const revalidate = 120; // ISR: revalidate module pages every 2 minutes

export default async function OrganizationOwnerModuleRoute({ params, searchParams }: OrgOwnerModuleRouteProps) {
  const { module: slug } = await params;
  const selectedModule = getOrganizationOwnerModule(slug);
  if (!selectedModule) notFound();

  const context = await requireOrganizationOwner(selectedModule.href);
  const filters = parseSearchParams(await searchParams);
  const requiredFeature = MODULE_FEATURE_MAP[slug];

  if (requiredFeature) {
    await requireOrganizationFeatureAccess({
      organizationId: context.organizationId,
      featureKey: requiredFeature,
      actionName: `organization.module.${slug}.read`,
    });
  }

  const [dashboard, planContext, moduleResult] = await Promise.all([
    getOrganizationOwnerDashboard(context),
    getOrgPlanContext(context.organizationId),
    resolveModuleData(slug, context, filters)
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/organization", label: "Dashboard" }, { href: selectedModule.href, label: selectedModule.label }]} />
      <OrganizationOwnerWorkspace dashboard={dashboard} module={selectedModule} moduleData={moduleResult.moduleData} moduleFilters={filters} planContext={planContext} />
    </div>
  );
}
