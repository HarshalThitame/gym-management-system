import type { Metadata } from "next";
import { CalendarCheck, CalendarDays, CalendarPlus, CreditCard, FileText, ListChecks, MessageSquare, Phone, ReceiptText, UserRoundPlus, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CardContent, CardHeader, CinematicCard } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { getReceptionDashboard } from "@/features/reception/services/reception-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Dashboard",
  description: "Front desk dashboard for reception staff to manage daily member service, check-ins, payments, appointments, and follow-ups.",
  path: "/reception"
});

const quickActions = [
  { label: "Register Member", detail: "Create a front-desk member record.", icon: UserRoundPlus, href: "/reception/register" },
  { label: "Check In", detail: "Search member or scan QR.", icon: CalendarCheck, href: "/reception/attendance" },
  { label: "Collect Payment", detail: "Review pending payments and receipts.", icon: CreditCard, href: "/reception/payments" },
  { label: "Book Appointment", detail: "Schedule consultations and trials.", icon: CalendarPlus, href: "/reception/appointments" },
  { label: "Add Lead", detail: "Capture walk-in or enquiry lead.", icon: Phone, href: "/reception/leads" },
  { label: "Book Class", detail: "Reserve a class seat.", icon: CalendarDays, href: "/reception/classes" },
  { label: "Create Task", detail: "Add follow-up or daily task.", icon: ListChecks, href: "/reception/tasks" },
  { label: "Send Reminder", detail: "Message a member about renewal/visit.", icon: MessageSquare, href: "/reception/messages" },
  { label: "View Reports", detail: "Daily reports and shift summary.", icon: FileText, href: "/reception/reports" }
];

export default async function ReceptionDashboardPage() {
  const scope = await requireReceptionScope("/reception");
  const dashboard = await getReceptionDashboard(scope.gymId, {
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Front Desk Operations</p>
        <h2 className="mt-2 text-3xl font-black bg-gradient-to-r from-foreground via-accent to-purple-400 bg-clip-text text-transparent">
          Today at reception
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Reception access is limited to assigned branch operational workflows: member lookup, registration, check-ins, payments, classes, reminders, and daily work queues.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Members checked in today" icon={<CalendarCheck className="size-5" />} label="Today's Check-Ins" value={String(dashboard.metrics.todayCheckIns)} />
        <StatCard detail="New walk-ins or signups" icon={<UserRoundPlus className="size-5" />} label="Today's Registrations" value={String(dashboard.metrics.todayRegistrations)} />
        <StatCard detail={`${dashboard.metrics.pendingRenewals} renewals due within 7 days`} icon={<UsersRound className="size-5" />} label="Pending Renewals" value={String(dashboard.metrics.pendingRenewals)} />
        <StatCard detail={formatCurrency(dashboard.metrics.todayPaymentAmount)} icon={<CreditCard className="size-5" />} label="Today's Payments" value={String(dashboard.metrics.todayPayments)} />
        <StatCard detail="New lead enquiries today" icon={<MessageSquare className="size-5" />} label="Today's Leads" value={String(dashboard.metrics.todayLeads)} />
        <StatCard detail="Scheduled appointments today" icon={<CalendarDays className="size-5" />} label="Appointments" value={String(dashboard.metrics.appointments)} />
        <StatCard detail="Classes scheduled in the next 7 days" icon={<CalendarDays className="size-5" />} label="Upcoming Classes" value={String(dashboard.metrics.upcomingClasses)} />
        <StatCard detail={`${dashboard.metrics.pendingPayments} open payment records`} icon={<ReceiptText className="size-5" />} label="Recent Activities" value={String(dashboard.metrics.recentActivities)} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {quickActions.slice(0, 5).map((action) => (
          <ButtonLink
            className="min-h-36 items-stretch justify-start whitespace-normal text-left hover:-translate-y-1 hover:shadow-premium-lg transition-all duration-300"
            href={action.href}
            key={action.label}
            variant="secondary"
          >
            <CardContent className="flex h-full flex-col justify-between p-5">
              <div className="rounded-lg bg-gradient-to-br from-accent/30 to-purple-500/20 p-2.5 text-foreground w-fit shadow-glow-sm">
                <action.icon aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="text-base font-black">{action.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.detail}</p>
              </div>
            </CardContent>
          </ButtonLink>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.slice(5).map((action) => (
          <ButtonLink
            className="min-h-36 items-stretch justify-start whitespace-normal text-left hover:-translate-y-1 hover:shadow-premium-lg transition-all duration-300"
            href={action.href}
            key={action.label}
            variant="secondary"
          >
            <CardContent className="flex h-full flex-col justify-between p-5">
              <div className="rounded-lg bg-gradient-to-br from-accent/30 to-purple-500/20 p-2.5 text-foreground w-fit shadow-glow-sm">
                <action.icon aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="text-base font-black">{action.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.detail}</p>
              </div>
            </CardContent>
          </ButtonLink>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <CinematicCard variant="gradient-border">
          <CardHeader>
            <h3 className="text-2xl font-black">Daily work queue</h3>
            <p className="text-sm leading-6 text-muted-foreground">Renewals, lead follow-ups, trial visits, appointments, and pending payments will appear here.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <Task label="Renewal follow-ups" value={dashboard.metrics.pendingRenewals} />
              <Task label="Pending payment follow-ups" value={dashboard.metrics.pendingPayments} />
              <Task label="Lead follow-ups" value={dashboard.leads.filter((lead) => lead.status === "new" || lead.status === "contacted").length} />
              <Task label="Appointment follow-ups" value={dashboard.metrics.appointments} />
            </div>
          </CardContent>
        </CinematicCard>
        <CinematicCard variant="gradient-border">
          <CardHeader>
            <h3 className="text-2xl font-black">Recent activity</h3>
            <p className="text-sm leading-6 text-muted-foreground">Reception activity is audited and scoped to the assigned branch.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.recentSessions.slice(0, 4).map((session) => (
                <ActivityRow detail={new Date(session.check_in_at).toLocaleString("en-IN")} key={session.id} label="Attendance" value={session.status} />
              ))}
              {dashboard.payments.slice(0, 4).map((payment) => (
                <ActivityRow detail={new Date(payment.created_at).toLocaleString("en-IN")} key={payment.id} label={payment.payment_number} value={payment.status} />
              ))}
              {dashboard.recentSessions.length === 0 && dashboard.payments.length === 0 ? <EmptyState text="Activity appears after check-ins, payments, registration, and reminders." /> : null}
            </div>
          </CardContent>
        </CinematicCard>
      </section>
    </div>
  );
}

function Task({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-gradient-to-br from-surface to-surface-muted p-4 backdrop-blur-sm transition-all duration-300 hover:border-accent/30 hover:shadow-glow-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">{value}</p>
    </div>
  );
}

function ActivityRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-gradient-to-r from-surface to-surface-muted p-4 backdrop-blur-sm transition-all duration-300 hover:border-accent/20">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{label}</p>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{value.replaceAll("_", " ")}</p>
      </div>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
      {text}
    </div>
  );
}
