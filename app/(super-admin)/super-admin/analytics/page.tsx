import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getEnterpriseAnalyticsDashboard } from "@/features/analytics/services/enterprise-analytics-service";
import { EnterpriseAnalyticsDashboardClient } from "./enterprise-analytics-dashboard";

export const metadata: Metadata = createMetadata({
  title: "Enterprise Analytics & Business Intelligence Center",
  description: "Executive BI, revenue intelligence, membership analytics, churn prediction, LTV, branch performance, marketing attribution, and predictive forecasting for the multi-tenant platform.",
  path: "/super-admin/analytics"
});

export default async function EnterpriseAnalyticsPage() {
  const context = await requireRole(["super_admin"], "/super-admin/analytics");
  const dashboard = await getEnterpriseAnalyticsDashboard(null);

  return (
    <EnterpriseAnalyticsDashboardClient
      context={context}
      dashboard={dashboard}
    />
  );
}
