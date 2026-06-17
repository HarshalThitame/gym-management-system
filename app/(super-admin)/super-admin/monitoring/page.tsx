import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getMonitoringDashboard } from "@/features/monitoring/services/monitoring-service";
import { MonitoringDashboardClient } from "./monitoring-dashboard-client";

export const metadata: Metadata = createMetadata({
  title: "Platform Monitoring Center",
  description: "Real-time platform health, usage overview, subscription monitoring, system activity, security alerts, error tracking, and data integrity checks.",
  path: "/super-admin/monitoring",
});

export default async function MonitoringPage() {
  const context = await requireRole(["super_admin"], "/super-admin/monitoring");
  const dashboard = await getMonitoringDashboard();
  return <MonitoringDashboardClient context={context} dashboard={dashboard} />;
}
