import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { organizationOwnerNavItems } from "@/features/organization-owner/lib/organization-owner-modules";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

export default async function OrganizationOwnerLayout({ children }: { children: ReactNode }) {
  const context = await requireOrganizationOwner("/organization");
  const planContext = await getOrgPlanContext(context.organizationId);

  return (
    <PortalShell
      branchName="Organization-wide tenant scope"
      context={context}
      eyebrow="Organization Owner Portal"
      navItems={organizationOwnerNavItems}
      planContext={planContext}
      planManageHref="/organization/plan"
      showPlanIndicator
      tenantInitial="O"
      tenantName="Organization Workspace"
      tenantShortName="Owner"
      title="Organization Command Center"
    >
      {children}
    </PortalShell>
  );
}
