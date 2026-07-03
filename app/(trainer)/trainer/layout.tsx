import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { getOrganizationEntitlements } from "@/features/entitlement";
import { buildPortalNavFromEntitlements } from "@/features/entitlement/portal-gates";
import { requireTrainerPortalAccess } from "@/features/trainer/lib/access";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getTenantSiteConfig } from "@/lib/tenant/site";
import { PageTransitionWrapper } from "./dynamic-components";

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const [context, tenantSite] = await Promise.all([
    requireTrainerPortalAccess("/trainer"),
    getTenantSiteConfig()
  ]);
  const [planContext, entitlements] = context.organizationId
    ? await Promise.all([getOrgPlanContext(context.organizationId), getOrganizationEntitlements(context.organizationId)])
    : [null, null];
  const navItems = entitlements
    ? buildPortalNavFromEntitlements("trainer", entitlements.activeFeatureKeys)
    : buildPortalNavFromEntitlements("trainer", []);

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={context}
      eyebrow="Trainer Portal"
      navItems={navItems}
      planContext={planContext}
      showPlanIndicator
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Trainer Dashboard"
    >
      <PageTransitionWrapper>{children}</PageTransitionWrapper>
    </PortalShell>
  );
}
