import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { UxGovernanceDashboard } from "./ux-governance-dashboard";

export const metadata: Metadata = createMetadata({
  title: "UX Quality, Design System & Experience Governance",
  description: "Enterprise design system, component library, accessibility compliance, keyboard shortcuts, user preferences, and UX quality scoring.",
  path: "/super-admin/ux-governance"
});

export default async function UxGovernancePage() {
  const context = await requireRole(["super_admin"], "/super-admin/ux-governance");
  return <UxGovernanceDashboard context={context} />;
}
