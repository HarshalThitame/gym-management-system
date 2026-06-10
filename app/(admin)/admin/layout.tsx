import { Activity, BarChart3, Brain, BriefcaseBusiness, CalendarCheck, CalendarDays, CreditCard, Dumbbell, Gauge, MessageSquare, Settings, Tags, UserRoundPlus, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireRole } from "@/lib/auth/guards";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/members", label: "Members", icon: UsersRound },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/admin/classes", label: "Classes", icon: CalendarDays },
  { href: "/admin/fitness", label: "Fitness", icon: Activity },
  { href: "/admin/trainers", label: "Trainers", icon: Dumbbell },
  { href: "/admin/membership-plans", label: "Plans", icon: Tags },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/communications", label: "Communications", icon: MessageSquare },
  { href: "/admin/ai", label: "AI Intelligence", icon: Brain },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/staff", label: "Staff", icon: BriefcaseBusiness },
  { href: "/admin/members", label: "Create User", icon: UserRoundPlus },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin");

  return (
    <PortalShell context={context} eyebrow="Admin Panel" navItems={adminNav} title="Operations Dashboard">
      {children}
    </PortalShell>
  );
}
