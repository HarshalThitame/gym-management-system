import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrganizationOwnerWorkspace } from "@/features/organization-owner/components/organization-owner-workspace";
import { getOrganizationOwnerModule, organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { resolveModuleData, type ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { MODULE_FEATURE_MAP, isEntitlementError } from "@/features/entitlement";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import type { ScopedOrganizationOwnerContext } from "@/features/organization-owner/services/organization-owner-service";
import type { OrganizationOwnerModule } from "@/features/organization-owner/lib/organization-owner-modules";

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
    source: get("source"),
    role: get("role"),
    gymId: get("gymId"),
    sort: get("sort"),
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
    page: get("page") ? Math.max(1, Number(get("page"))) : 1,
    pageSize: get("pageSize") ? Math.min(50, Math.max(5, Number(get("pageSize")))) : 12
  };
}

export const revalidate = 120;

function ModulePageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <section className="rounded-lg border border-border bg-surface p-5 md:p-7">
        <div className="h-4 w-48 rounded bg-muted/60" />
        <div className="mt-3 h-8 w-72 rounded bg-muted/60" />
        <div className="mt-2 h-4 w-96 rounded bg-muted/60" />
      </section>
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="h-6 w-40 rounded bg-muted/60" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-12 w-12 rounded-full bg-muted/60" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-3/4 rounded bg-muted/60" />
                <div className="h-3 w-1/2 rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function ModuleContentLoader({
  context,
  module,
  filters,
  moduleData
}: {
  context: ScopedOrganizationOwnerContext;
  module: OrganizationOwnerModule;
  filters: ModuleSearchParams;
  moduleData: unknown;
}) {
  const [dashboard, planContext] = await Promise.all([
    getOrganizationOwnerDashboard(context),
    getOrgPlanContext(context.organizationId),
  ]);

  return (
    <OrganizationOwnerWorkspace
      dashboard={dashboard}
      module={module}
      moduleData={moduleData}
      moduleFilters={filters}
      planContext={planContext}
    />
  );
}

export default async function OrganizationOwnerModuleRoute({ params, searchParams }: OrgOwnerModuleRouteProps) {
  const { module: slug } = await params;
  const selectedModule = getOrganizationOwnerModule(slug);
  if (!selectedModule) notFound();

  const context = await requireOrganizationOwner(selectedModule.href);
  const filters = parseSearchParams(await searchParams);
  const requiredFeature = MODULE_FEATURE_MAP[slug];

  if (requiredFeature) {
    try {
      await requireOrganizationFeatureAccess({
        organizationId: context.organizationId,
        featureKey: requiredFeature,
        actionName: `organization.module.${slug}.read`,
      });
    } catch (err) {
      if (isEntitlementError(err)) {
        const params = new URLSearchParams();
        if (err.featureKey) params.set("feature", err.featureKey);
        if (err.reason) params.set("reason", err.reason);
        redirect(`/organization/locked-feature?${params.toString()}`);
      }
      throw err;
    }
  }

  // Fetch module data immediately, stream dashboard + plan context
  const moduleResult = await resolveModuleData(slug, context, filters);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/organization", label: "Dashboard" }, { href: selectedModule.href, label: selectedModule.label }]} />
      <Suspense fallback={<ModulePageSkeleton />}>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <ModuleContentLoader
            context={context}
            module={selectedModule}
            filters={filters}
            moduleData={moduleResult.moduleData}
          />
        </div>
      </Suspense>
    </div>
  );
}
