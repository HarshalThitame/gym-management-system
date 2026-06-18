import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { buildEntitlementFilteredNavItems } from "@/features/organization-owner/lib/organization-owner-modules";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getOrganizationEntitlements } from "@/features/entitlement";
import { OrgOwnerLayoutClient } from "@/features/organization-owner/components/org-owner-layout-client";

export default async function OrganizationOwnerLayout({ children }: { children: ReactNode }) {
  const context = await requireOrganizationOwner("/organization");
  const [planContext, entitlements] = await Promise.all([
    getOrgPlanContext(context.organizationId),
    getOrganizationEntitlements(context.organizationId),
  ]);
  const navItems = buildEntitlementFilteredNavItems(entitlements.activeFeatureKeys, planContext.packageName);

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg"
        href="#org-owner-main"
      >
        Skip to main content
      </a>
      <PortalShell
        branchName="Organization-wide tenant scope"
        context={context}
        eyebrow="Organization Owner Portal"
        navItems={navItems}
        planContext={planContext}
        planManageHref="/organization/plan"
        showPlanIndicator
        tenantInitial="O"
        tenantName="Organization Workspace"
        tenantShortName="Owner"
        title="Organization Command Center"
      >
        <main id="org-owner-main" tabIndex={-1}>
          <OrgOwnerLayoutClient organizationId={context.organizationId} planContext={planContext} activeFeatureKeys={entitlements.activeFeatureKeys}>
            {children}
          </OrgOwnerLayoutClient>
        </main>
      </PortalShell>
    </>
  );
}
