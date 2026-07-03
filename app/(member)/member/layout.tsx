import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { getOrganizationEntitlements } from "@/features/entitlement";
import { buildPortalNavFromEntitlements } from "@/features/entitlement/portal-gates";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { MemberPageWrapper } from "@/features/member/components/member-page-wrapper";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getTenantSiteConfig } from "@/lib/tenant/site";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const [context, tenantSite] = await Promise.all([
    requireMemberPortalAccess("/member"),
    getTenantSiteConfig()
  ]);
  const [planContext, entitlements] = context.organizationId
    ? await Promise.all([getOrgPlanContext(context.organizationId), getOrganizationEntitlements(context.organizationId)])
    : [null, null];
  const navItems = entitlements
    ? buildPortalNavFromEntitlements("member", entitlements.activeFeatureKeys)
    : buildPortalNavFromEntitlements("member", []);

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={context}
      eyebrow="Member Portal"
      navItems={navItems}
      planBannerMode="suspended-only"
      planContext={planContext}
      showPlanIndicator
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Member Dashboard"
    >
      <MemberPageWrapper>{children}</MemberPageWrapper>
    </PortalShell>
  );
}
