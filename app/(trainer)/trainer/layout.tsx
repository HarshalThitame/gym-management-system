import { Activity, Brain, CalendarCheck, CalendarDays, Clock, Dumbbell, Gauge, MessageSquare, TrendingUp, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell, type PortalNavItem } from "@/components/layout/portal-shell";
import { requireRole } from "@/lib/auth/guards";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { getTenantSiteConfig } from "@/lib/tenant/site";
import { PageTransitionWrapper, CommandPalette } from "./dynamic-components";

const trainerNav = [
  { href: "/trainer", label: "Dashboard", icon: <Gauge className="size-5" />, iconKey: "gauge" },
  { href: "/trainer/members", label: "Assigned Members", icon: <UsersRound className="size-5" />, iconKey: "users" },
  { href: "/trainer/attendance", label: "Attendance", icon: <CalendarCheck className="size-5" />, iconKey: "calendar-check" },
  { href: "/trainer/classes", label: "Classes", icon: <CalendarDays className="size-5" />, iconKey: "calendar-days" },
  { href: "/trainer/sessions", label: "Sessions", icon: <CalendarCheck className="size-5" />, iconKey: "calendar-check" },
  { href: "/trainer/programs", label: "Programs", icon: <Dumbbell className="size-5" />, iconKey: "dumbbell" },
  { href: "/trainer/progress", label: "Progress", icon: <Activity className="size-5" />, iconKey: "activity" },
  { href: "/trainer/ai", label: "AI Assistant", icon: <Brain className="size-5" />, iconKey: "brain" },
  { href: "/trainer/availability", label: "Availability", icon: <Clock className="size-5" />, iconKey: "clock" },
  { href: "/trainer/performance", label: "Performance", icon: <TrendingUp className="size-5" />, iconKey: "trending-up" },
  { href: "/trainer/communications", label: "Communications", icon: <MessageSquare className="size-5" />, iconKey: "message-square" }
] satisfies PortalNavItem[];

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const [context, tenantSite] = await Promise.all([
    requireRole(["trainer"], "/trainer"),
    getTenantSiteConfig()
  ]);
  const planContext = context.organizationId ? await getOrgPlanContext(context.organizationId) : null;

  return (
    <PortalShell
      branchName={tenantSite.branchName}
      context={context}
      eyebrow="Trainer Portal"
      navItems={trainerNav}
      planContext={planContext}
      showPlanIndicator
      tenantInitial={tenantSite.brandInitial}
      tenantName={tenantSite.name}
      tenantShortName={tenantSite.shortName}
      title="Trainer Dashboard"
    >
      <PageTransitionWrapper>{children}</PageTransitionWrapper>
      <CommandPalette />
    </PortalShell>
  );
}
