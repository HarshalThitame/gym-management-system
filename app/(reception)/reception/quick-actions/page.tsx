import type { Metadata } from "next";
import { CalendarCheck, CalendarDays, CalendarPlus, CreditCard, FileText, ListChecks, MessageSquare, Phone, UserRoundPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Quick Actions",
  description: "Fast access to the most common front desk operations.",
  path: "/reception/quick-actions"
});

const quickActionGroups = [
  {
    title: "Member Actions",
    items: [
      { label: "Register Member", description: "Quick member onboarding", href: "/reception/register", icon: UserRoundPlus },
      { label: "Member Search", description: "Find member by name, phone, or code", href: "/reception/members", icon: FileText },
      { label: "Manage Documents", description: "Upload/view member documents", href: "/reception/documents", icon: FileText },
      { label: "Memberships", description: "View/renew memberships", href: "/reception/memberships", icon: CalendarCheck }
    ]
  },
  {
    title: "Daily Operations",
    items: [
      { label: "Check-In", description: "Manual or QR code check-in", href: "/reception/attendance", icon: CalendarCheck },
      { label: "Collect Payment", description: "Cash, UPI, or card payment", href: "/reception/payments", icon: CreditCard },
      { label: "Book Class", description: "Reserve class seats", href: "/reception/classes", icon: CalendarDays },
      { label: "Schedule Appointment", description: "Consultations and trials", href: "/reception/appointments", icon: CalendarPlus }
    ]
  },
  {
    title: "Sales & Follow-Up",
    items: [
      { label: "Add Lead", description: "Capture walk-in enquiry", href: "/reception/leads", icon: Phone },
      { label: "Send Message", description: "Member reminders", href: "/reception/messages", icon: MessageSquare },
      { label: "My Tasks", description: "View assigned tasks", href: "/reception/tasks", icon: ListChecks },
      { label: "Daily Reports", description: "View shift reports", href: "/reception/reports", icon: FileText }
    ]
  }
];

export default async function ReceptionQuickActionsPage() {
  const scope = await requireReceptionScope("/reception/quick-actions");

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Quick Actions</p>
        <h2 className="mt-2 text-3xl font-black">Quick access center</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Frequently used front desk operations in one place. Choose an action to get started.
        </p>
      </section>

      {quickActionGroups.map((group) => (
        <section key={group.title}>
          <h3 className="mb-4 text-xl font-black">{group.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {group.items.map((item) => (
              <ButtonLink
                className="min-h-28 items-stretch justify-start whitespace-normal text-left"
                href={item.href}
                key={item.label}
                variant="secondary"
              >
                <div className="flex h-full flex-col justify-between p-4">
                  <div className="rounded-md bg-accent/20 p-2 text-foreground w-fit">
                    <item.icon aria-hidden="true" className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-black">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </ButtonLink>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
