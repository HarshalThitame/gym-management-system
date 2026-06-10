import { Activity, Bell, Bot, CalendarCheck, CalendarDays, CreditCard, Dumbbell, Gauge, ReceiptText, Settings, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireRole } from "@/lib/auth/guards";

const memberNav = [
  { href: "/member", label: "Dashboard", icon: Gauge },
  { href: "/member/membership", label: "Membership", icon: CreditCard },
  { href: "/member/payments", label: "Payments", icon: ReceiptText },
  { href: "/member/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/member/classes", label: "Classes", icon: CalendarDays },
  { href: "/member/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/member/fitness", label: "Fitness", icon: Activity },
  { href: "/member/ai-coach", label: "AI Coach", icon: Bot },
  { href: "/member/notifications", label: "Notifications", icon: Bell },
  { href: "/member/profile", label: "Profile", icon: UserRound },
  { href: "/member/settings", label: "Settings", icon: Settings }
];

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const context = await requireRole(["member", "super_admin"], "/member");

  return (
    <PortalShell context={context} eyebrow="Member Portal" navItems={memberNav} title="Member Dashboard">
      {children}
    </PortalShell>
  );
}
