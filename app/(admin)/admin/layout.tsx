import { Activity, BarChart3, Brain, BriefcaseBusiness, CalendarCheck, CalendarDays, CreditCard, Dumbbell, Gauge, MessageSquare, Settings, Tags, UserRoundPlus, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell, type PortalNavItem } from "@/components/layout/portal-shell";
import { requireRole } from "@/lib/auth/guards";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: Gauge, iconKey: "gauge" },
  { href: "/admin/members", label: "Members", icon: UsersRound, iconKey: "users" },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck, iconKey: "calendar-check" },
  { href: "/admin/classes", label: "Classes", icon: CalendarDays, iconKey: "calendar-days" },
  { href: "/admin/fitness", label: "Fitness", icon: Activity, iconKey: "activity" },
  { href: "/admin/trainers", label: "Trainers", icon: Dumbbell, iconKey: "dumbbell" },
  { href: "/admin/membership-plans", label: "Plans", icon: Tags, iconKey: "tags" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, iconKey: "credit-card" },
  { href: "/admin/communications", label: "Communications", icon: MessageSquare, iconKey: "message-square" },
  { href: "/admin/ai", label: "AI Intelligence", icon: Brain, iconKey: "brain" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, iconKey: "bar-chart" },
  { href: "/admin/staff", label: "Staff", icon: BriefcaseBusiness, iconKey: "briefcase" },
  { href: "/admin/members", label: "Create User", icon: UserRoundPlus, iconKey: "user-plus" },
  { href: "/admin/settings", label: "Settings", icon: Settings, iconKey: "settings" }
] satisfies PortalNavItem[];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin");

  return (
    <PortalShell context={context} eyebrow="Admin Panel" navItems={adminNav} title="Operations Dashboard">
      {children}
    </PortalShell>
  );
}
