import type { Metadata } from "next";
import { getEnterpriseDashboard } from "@/features/enterprise/services/enterprise-service";
import { SuperAdminDashboard } from "@/features/super-admin/components/super-admin-dashboard";
import { getAllOrgsWithSubscriptions } from "@/features/super-admin/services/subscription-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Super Admin Console",
  description: "Global SaaS command center for organizations, gyms, subscriptions, security, monitoring, and platform governance.",
  path: "/super-admin"
});

export default async function SuperAdminDashboardPage() {
  const [dashboard, orgSubscriptions] = await Promise.all([
    getEnterpriseDashboard(),
    getAllOrgsWithSubscriptions()
  ]);

  return <SuperAdminDashboard dashboard={dashboard} orgSubscriptions={orgSubscriptions} />;
}
