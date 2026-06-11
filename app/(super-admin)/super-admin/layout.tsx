import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { superAdminNavItems } from "@/features/super-admin/lib/super-admin-modules";
import { requireRole } from "@/lib/auth/guards";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const context = await requireRole(["super_admin"], "/super-admin");

  return (
    <PortalShell
      branchName="Global SaaS Platform"
      context={context}
      eyebrow="Super Admin Console"
      navItems={superAdminNavItems}
      tenantInitial="A"
      tenantName="Apex Gym Management SaaS"
      tenantShortName="Apex SaaS"
      title="Platform Control Center"
    >
      {children}
    </PortalShell>
  );
}
