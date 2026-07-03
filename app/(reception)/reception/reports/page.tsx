import type { Metadata } from "next";
import { BarChart3, CalendarCheck, CreditCard, Download, FileSpreadsheet, FileText, UserRoundPlus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { getReceptionDashboard } from "@/features/reception/services/reception-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Reports",
  description: "Daily operational reports for attendance, payments, registrations, and follow-ups.",
  path: "/reception/reports"
});

const reportCards = [
  { title: "Daily Attendance", description: "Today's check-ins, check-outs, peak hours, and occupancy.", icon: CalendarCheck, href: "/reception/reports/attendance" },
  { title: "Daily Payments", description: "Payment collection summary, methods, pending dues, and cash report.", icon: CreditCard, href: "/reception/reports/payments" },
  { title: "New Registrations", description: "New member registrations, walk-ins, trials, and conversions.", icon: UserRoundPlus, href: "/reception/reports/registrations" },
  { title: "Lead Follow-Up", description: "Lead pipeline, follow-ups due, conversion rates, and sources.", icon: BarChart3, href: "/reception/reports/leads" },
  { title: "Renewals Due", description: "Memberships expiring soon, renewal actions pending.", icon: FileText, href: "/reception/reports/renewals" },
  { title: "Export Reports", description: "Download daily reports as CSV or PDF for shift handover.", icon: Download, href: "/reception/reports/export" }
];

export default async function ReceptionReportsPage() {
  const scope = await requireReceptionScope("/reception/reports");
  const dashboard = await getReceptionDashboard(scope.gymId, {
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reports</p>
        <h2 className="mt-2 text-3xl font-black">Daily reports</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          View and export daily operational reports for attendance, payments, registrations, and follow-ups. Advanced analytics and multi-branch reports remain restricted to management.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Check-ins today" icon={<CalendarCheck className="size-5" />} label="Attendance" value={String(dashboard.metrics.todayCheckIns)} />
        <StatCard detail="Payments today" icon={<CreditCard className="size-5" />} label="Payments" value={String(dashboard.metrics.todayPayments)} />
        <StatCard detail="New members today" icon={<UserRoundPlus className="size-5" />} label="Registrations" value={String(dashboard.metrics.todayRegistrations)} />
        <StatCard detail="New leads today" icon={<BarChart3 className="size-5" />} label="Leads" value={String(dashboard.metrics.todayLeads)} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((card) => (
          <Card className="flex flex-col border-dashed border-border bg-surface-muted p-6" key={card.title}>
            <card.icon className="mb-3 size-8 text-accent" />
            <p className="text-lg font-black">{card.title}</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{card.description}</p>
            <ButtonLink className="mt-4" href={card.href} size="sm" variant="secondary">
              <FileSpreadsheet className="size-3.5" />
              View Report
            </ButtonLink>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Quick Summary</h3>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Daily Summary</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Today: {dashboard.metrics.todayCheckIns} check-ins, {dashboard.metrics.todayRegistrations} registrations,
                {" "}{dashboard.metrics.todayPayments} payments, {dashboard.metrics.todayLeads} leads.
                {" "}{dashboard.metrics.pendingRenewals} renewals due within 7 days.
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Work Queue</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {dashboard.metrics.pendingPayments} pending payments, {dashboard.metrics.pendingRenewals} renewals due,
                {" "}{dashboard.metrics.appointments} appointments today.
                Export report for shift handover or end-of-day submission.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
