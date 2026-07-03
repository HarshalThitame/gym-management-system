import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { getOrganizationEntitlements } from "@/features/entitlement";
import { buildPortalNavFromEntitlements } from "@/features/entitlement/portal-gates";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { getTenantSiteConfig } from "@/lib/tenant/site";

export default async function ReceptionLayout({ children }: { children: ReactNode }) {
  const [context, tenantSite] = await Promise.all([
    requireReceptionScope("/reception"),
    getTenantSiteConfig()
  ]);
  const organizationId = context.scopedOrganizationId ?? context.organizationId;
  const entitlements = organizationId ? await getOrganizationEntitlements(organizationId) : null;
  const navItems = entitlements
    ? buildPortalNavFromEntitlements("reception", entitlements.activeFeatureKeys)
    : buildPortalNavFromEntitlements("reception", []);

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={context}
      eyebrow="Reception Portal"
      navItems={navItems}
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Front Desk Dashboard"
    >
      {children}
    </PortalShell>
  );
}
