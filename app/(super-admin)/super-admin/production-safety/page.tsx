import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getSafetyDashboard } from "@/features/safety/services/safety-service";
import { ProductionSafetyDashboard } from "./production-safety-dashboard";

export const metadata: Metadata = createMetadata({
  title: "Enterprise Production Safety & Operational Governance",
  description: "Operational risk monitoring, destructive action protection, multi-step confirmation workflows, change impact analysis, permission transparency, rate limiting, financial operation protection, and emergency override management.",
  path: "/super-admin/production-safety"
});

export default async function SafetyPage() {
  const context = await requireRole(["super_admin"], "/super-admin/production-safety");
  const dashboard = await getSafetyDashboard();
  return <ProductionSafetyDashboard context={context} dashboard={dashboard} />;
}
