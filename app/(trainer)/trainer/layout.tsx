import { Activity, Brain, CalendarCheck, CalendarDays, Dumbbell, Gauge, MessageSquare, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireRole } from "@/lib/auth/guards";

const trainerNav = [
  { href: "/trainer", label: "Dashboard", icon: Gauge },
  { href: "/trainer/members", label: "Assigned Members", icon: UsersRound },
  { href: "/trainer/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/trainer/classes", label: "Classes", icon: CalendarDays },
  { href: "/trainer/sessions", label: "Sessions", icon: CalendarCheck },
  { href: "/trainer/programs", label: "Programs", icon: Dumbbell },
  { href: "/trainer/progress", label: "Progress", icon: Activity },
  { href: "/trainer/ai", label: "AI Assistant", icon: Brain },
  { href: "/trainer/communications", label: "Communications", icon: MessageSquare }
];

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const context = await requireRole(["trainer", "gym_admin", "super_admin"], "/trainer");

  return (
    <PortalShell context={context} eyebrow="Trainer Portal" navItems={trainerNav} title="Trainer Dashboard">
      {children}
    </PortalShell>
  );
}
