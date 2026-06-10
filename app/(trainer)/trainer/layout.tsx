import { Activity, Brain, CalendarCheck, CalendarDays, Dumbbell, Gauge, MessageSquare, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell, type PortalNavItem } from "@/components/layout/portal-shell";
import { requireRole } from "@/lib/auth/guards";

const trainerNav = [
  { href: "/trainer", label: "Dashboard", icon: Gauge, iconKey: "gauge" },
  { href: "/trainer/members", label: "Assigned Members", icon: UsersRound, iconKey: "users" },
  { href: "/trainer/attendance", label: "Attendance", icon: CalendarCheck, iconKey: "calendar-check" },
  { href: "/trainer/classes", label: "Classes", icon: CalendarDays, iconKey: "calendar-days" },
  { href: "/trainer/sessions", label: "Sessions", icon: CalendarCheck, iconKey: "calendar-check" },
  { href: "/trainer/programs", label: "Programs", icon: Dumbbell, iconKey: "dumbbell" },
  { href: "/trainer/progress", label: "Progress", icon: Activity, iconKey: "activity" },
  { href: "/trainer/ai", label: "AI Assistant", icon: Brain, iconKey: "brain" },
  { href: "/trainer/communications", label: "Communications", icon: MessageSquare, iconKey: "message-square" }
] satisfies PortalNavItem[];

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const context = await requireRole(["trainer", "gym_admin", "super_admin"], "/trainer");

  return (
    <PortalShell context={context} eyebrow="Trainer Portal" navItems={trainerNav} title="Trainer Dashboard">
      {children}
    </PortalShell>
  );
}
