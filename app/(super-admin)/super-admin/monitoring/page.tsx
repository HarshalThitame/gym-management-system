import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getObservabilityDashboard } from "@/features/observability/services/observability-service";
import { ObservabilityDashboardClient } from "./observability-dashboard";

export const metadata: Metadata = createMetadata({
  title: "Enterprise Observability & Monitoring Center",
  description: "Real-time platform health, incident management, queue monitoring, cron intelligence, error tracking, on-call scheduling, status pages, capacity planning, and SLO/SLA tracking.",
  path: "/super-admin/monitoring"
});

export default async function ObservabilityPage() {
  const context = await requireRole(["super_admin"], "/super-admin/monitoring");
  const dashboard = await getObservabilityDashboard();
  return <ObservabilityDashboardClient context={context} dashboard={dashboard} />;
}
