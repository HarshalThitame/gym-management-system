import type { Metadata } from "next";
import { OrganizationOwnerWorkspace } from "@/features/organization-owner/components/organization-owner-workspace";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

export const metadata: Metadata = createMetadata({
  title: "Organization Owner Dashboard",
  description: "Tenant-safe organization command center for owned gyms, branches, members, staff, revenue, domains, and audit activity.",
  path: "/organization"
});

export default async function OrganizationOwnerDashboardPage() {
  const context = await requireOrganizationOwner("/organization");
  const [dashboard, planContext] = await Promise.all([
    getOrganizationOwnerDashboard(context),
    getOrgPlanContext(context.organizationId)
  ]);

  return <OrganizationOwnerWorkspace dashboard={dashboard} planContext={planContext} />;
}
