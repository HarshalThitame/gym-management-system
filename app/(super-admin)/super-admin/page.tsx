import type { Metadata } from "next";
import { getEnterpriseDashboard } from "@/features/enterprise/services/enterprise-service";
import { SuperAdminDashboard } from "@/features/super-admin/components/super-admin-dashboard";
import { getSuperAdminDashboardOperations, resolveDashboardDateRange } from "@/features/super-admin/services/dashboard-service";
import { getAllOrgsWithSubscriptions } from "@/features/super-admin/services/subscription-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Super Admin Console",
  description: "Global SaaS command center for organizations, gyms, subscriptions, security, monitoring, and platform governance.",
  path: "/super-admin"
});

type SuperAdminDashboardPageProps = {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function SuperAdminDashboardPage({ searchParams }: SuperAdminDashboardPageProps) {
  const params = await searchParams;
  const dateRange = resolveDashboardDateRange(params);
  const [dashboard, orgSubscriptions] = await Promise.all([
    getEnterpriseDashboard(),
    getAllOrgsWithSubscriptions()
  ]);
  const operations = await getSuperAdminDashboardOperations({
    dashboard,
    dateRange,
    orgSubscriptions
  });

  return <SuperAdminDashboard dashboard={dashboard} operations={operations} orgSubscriptions={orgSubscriptions} />;
}
