import { Activity, Bell, Bot, CalendarCheck, CalendarDays, CreditCard, Dumbbell, Gauge, ReceiptText, Settings, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell, type PortalNavItem } from "@/components/layout/portal-shell";
import { requirePrimaryRole } from "@/lib/auth/guards";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getTenantSiteConfig } from "@/lib/tenant/site";

const memberNav = [
  { href: "/member", label: "Dashboard", icon: <Gauge className="size-5" />, iconKey: "gauge" },
  { href: "/member/membership", label: "Membership", icon: <CreditCard className="size-5" />, iconKey: "credit-card" },
  { href: "/member/payments", label: "Payments", icon: <ReceiptText className="size-5" />, iconKey: "receipt" },
  { href: "/member/attendance", label: "Attendance", icon: <CalendarCheck className="size-5" />, iconKey: "calendar-check" },
  { href: "/member/classes", label: "Classes", icon: <CalendarDays className="size-5" />, iconKey: "calendar-days" },
  { href: "/member/workouts", label: "Workouts", icon: <Dumbbell className="size-5" />, iconKey: "dumbbell" },
  { href: "/member/fitness", label: "Fitness", icon: <Activity className="size-5" />, iconKey: "activity" },
  { href: "/member/ai-coach", label: "AI Coach", icon: <Bot className="size-5" />, iconKey: "bot" },
  { href: "/member/notifications", label: "Notifications", icon: <Bell className="size-5" />, iconKey: "bell" },
  { href: "/member/profile", label: "Profile", icon: <UserRound className="size-5" />, iconKey: "user" },
  { href: "/member/settings", label: "Settings", icon: <Settings className="size-5" />, iconKey: "settings" }
] satisfies PortalNavItem[];

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const [context, tenantSite] = await Promise.all([
    requirePrimaryRole(["member"], "/member"),
    getTenantSiteConfig()
  ]);
  const planContext = context.organizationId ? await getOrgPlanContext(context.organizationId) : null;

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={context}
      eyebrow="Member Portal"
      navItems={memberNav}
      planBannerMode="suspended-only"
      planContext={planContext}
      showPlanIndicator
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Member Dashboard"
    >
      {children}
    </PortalShell>
  );
}
