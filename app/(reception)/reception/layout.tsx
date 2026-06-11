import { CalendarCheck, CalendarDays, CreditCard, Gauge, MessageSquare, UserRoundPlus, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell, type PortalNavItem } from "@/components/layout/portal-shell";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { getTenantSiteConfig } from "@/lib/tenant/site";

const receptionNav = [
  { href: "/reception", label: "Dashboard", icon: Gauge, iconKey: "gauge" },
  { href: "/reception/members", label: "Members", icon: UsersRound, iconKey: "users" },
  { href: "/reception/register", label: "Register", icon: UserRoundPlus, iconKey: "user-plus" },
  { href: "/reception/attendance", label: "Attendance", icon: CalendarCheck, iconKey: "calendar-check" },
  { href: "/reception/payments", label: "Payments", icon: CreditCard, iconKey: "credit-card" },
  { href: "/reception/classes", label: "Classes", icon: CalendarDays, iconKey: "calendar-days" },
  { href: "/reception/messages", label: "Messages", icon: MessageSquare, iconKey: "message-square" }
] satisfies PortalNavItem[];

export default async function ReceptionLayout({ children }: { children: ReactNode }) {
  const [context, tenantSite] = await Promise.all([
    requireReceptionScope("/reception"),
    getTenantSiteConfig()
  ]);

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={context}
      eyebrow="Reception Portal"
      navItems={receptionNav}
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Front Desk Dashboard"
    >
      {children}
    </PortalShell>
  );
}
