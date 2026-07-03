import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { getOrganizationEntitlements } from "@/features/entitlement";
import { buildPortalNavFromEntitlements } from "@/features/entitlement/portal-gates";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getTenantSiteConfig } from "@/lib/tenant/site";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [scope, tenantSite] = await Promise.all([
    requireGymAdminScope("/admin"),
    getTenantSiteConfig()
  ]);
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const [planContext, entitlements] = organizationId
    ? await Promise.all([getOrgPlanContext(organizationId), getOrganizationEntitlements(organizationId)])
    : [null, null];
  const navItems = entitlements
    ? buildPortalNavFromEntitlements("gym-admin", entitlements.activeFeatureKeys)
    : buildPortalNavFromEntitlements("gym-admin", []);

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={scope}
      eyebrow="Admin Panel"
      navItems={navItems}
      planContext={planContext}
      showPlanIndicator
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Branch Operations Dashboard"
    >
      {children}
    </PortalShell>
  );
}
