import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { runFullAudit } from "@/features/super-admin/services/ux-governance-service";
import { UxGovernanceDashboard } from "./ux-governance-dashboard";

export const metadata: Metadata = createMetadata({
  title: "UX Quality, Design System & Experience Governance",
  description: "Enterprise design system, component library, accessibility compliance, and live UX quality scoring.",
  path: "/super-admin/ux-governance"
});

export default async function UxGovernancePage() {
  const context = await requireRole(["super_admin"], "/super-admin/ux-governance");
  const audit = runFullAudit();
  return <UxGovernanceDashboard context={context} initialAudit={audit} />;
}
