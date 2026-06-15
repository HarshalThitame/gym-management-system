import { Activity, BarChart3, Brain, BriefcaseBusiness, CalendarCheck, CalendarDays, CreditCard, Dumbbell, Gauge, MessageSquare, Settings, Tags, UserRoundPlus, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell, type PortalNavItem } from "@/components/layout/portal-shell";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getTenantSiteConfig } from "@/lib/tenant/site";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: <Gauge className="size-5" />, iconKey: "gauge" },
  { href: "/admin/members", label: "Members", icon: <UsersRound className="size-5" />, iconKey: "users" },
  { href: "/admin/attendance", label: "Attendance", icon: <CalendarCheck className="size-5" />, iconKey: "calendar-check" },
  { href: "/admin/classes", label: "Classes", icon: <CalendarDays className="size-5" />, iconKey: "calendar-days" },
  { href: "/admin/fitness", label: "Fitness", icon: <Activity className="size-5" />, iconKey: "activity" },
  { href: "/admin/trainers", label: "Trainers", icon: <Dumbbell className="size-5" />, iconKey: "dumbbell" },
  { href: "/admin/membership-plans", label: "Plans", icon: <Tags className="size-5" />, iconKey: "tags" },
  { href: "/admin/payments", label: "Payments", icon: <CreditCard className="size-5" />, iconKey: "credit-card" },
  { href: "/admin/communications", label: "Communications", icon: <MessageSquare className="size-5" />, iconKey: "message-square" },
  { href: "/admin/ai", label: "AI Intelligence", icon: <Brain className="size-5" />, iconKey: "brain" },
  { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="size-5" />, iconKey: "bar-chart" },
  { href: "/admin/staff", label: "Staff", icon: <BriefcaseBusiness className="size-5" />, iconKey: "briefcase" },
  { href: "/admin/members/new", label: "Create User", icon: <UserRoundPlus className="size-5" />, iconKey: "user-plus" },
  { href: "/admin/settings", label: "Settings", icon: <Settings className="size-5" />, iconKey: "settings" }
] satisfies PortalNavItem[];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [scope, tenantSite] = await Promise.all([
    requireGymAdminScope("/admin"),
    getTenantSiteConfig()
  ]);
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const planContext = organizationId ? await getOrgPlanContext(organizationId) : null;

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={scope}
      eyebrow="Admin Panel"
      navItems={adminNav}
      planContext={planContext}
      showPlanIndicator
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Branch Operations Dashboard"
    >
      {children}
    </PortalShell>
  );
}
