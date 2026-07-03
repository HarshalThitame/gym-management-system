import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  LifeBuoy,
  AlertCircle,
  CheckCircle,
  Clock,
  MessageSquare,
  Users,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getSupportDashboard } from "@/features/support-center/services/support-service";
import {
  CreateTicketForm,
  TicketStatusForm,
  TicketMessageForm,
  AssignTicketForm
} from "@/features/support-center/components/support-forms";
import { TicketStatusBadge, TicketPriorityBadge } from "@/features/support-center/components/support-status-badge";

export const metadata: Metadata = createMetadata({
  title: "Support Center",
  description: "Manage support tickets, track customer issues, and maintain service quality.",
  path: "/admin/support"
});

export default async function AdminSupportPage() {
  const scope = await requireGymAdminScope("/admin/support");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const dashboard = await getSupportDashboard(organizationId);
  const activeTickets = dashboard.metrics.openTickets + dashboard.metrics.pendingTickets;
  const conversationCount = dashboard.tickets.reduce((sum, ticket) => sum + (ticket.messages?.length ?? 0), 0);
  const assignedCount = dashboard.tickets.filter((ticket) => Boolean(ticket.assigned_to)).length;
  const ticketLoadLabel = activeTickets === 0
    ? "Inbox is under control"
    : `${activeTickets} active ticket${activeTickets === 1 ? "" : "s"} require attention`;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
      <section className="overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50 shadow-[0_30px_120px_rgba(15,23,42,0.22)]">
        <div className="grid gap-8 px-6 py-7 md:px-8 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:px-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-200/90">
              <ShieldCheck className="size-3.5" />
              Customer Support Command
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-black tracking-tight md:text-[2.4rem]">Support Center</h2>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  <Activity className="size-3.5" />
                  {ticketLoadLabel}
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-slate-300/90 md:text-[15px]">
                Run ticket operations from a single workspace with tighter queue visibility, cleaner ownership signals,
                and faster status actions for branch teams.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <HeroMetric
                icon={<Clock className="size-4" />}
                label="Pending Response"
                value={String(dashboard.metrics.pendingTickets)}
                tone="amber"
              />
              <HeroMetric
                icon={<AlertCircle className="size-4" />}
                label="SLA Risk"
                value={String(dashboard.metrics.breachedSla)}
                tone="rose"
              />
              <HeroMetric
                icon={<CheckCircle className="size-4" />}
                label="Resolved"
                value={String(dashboard.metrics.resolvedTickets)}
                tone="emerald"
              />
            </div>
          </div>

          <div className="grid gap-3 self-start rounded-[24px] border border-white/12 bg-white/6 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300/80">Operating Snapshot</p>
                <p className="mt-2 text-lg font-black text-white">Service quality at a glance</p>
              </div>
              <Sparkles className="size-5 text-cyan-200" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <SnapshotRow label="Open tickets" value={String(dashboard.metrics.openTickets)} />
              <SnapshotRow label="Closed tickets" value={String(dashboard.metrics.closedTickets)} />
              <SnapshotRow label="Customer conversations" value={String(conversationCount)} />
            </div>
            <div className="rounded-2xl border border-white/12 bg-slate-950/30 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300/80">Response Standard</p>
              <p className="mt-2 text-sm leading-6 text-slate-200/90">
                Prioritize breached and pending tickets first, then close the loop with a customer-facing update before shifting ownership.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          detail="Total support tickets"
          icon={<LifeBuoy className="size-5" />}
          label="Total Tickets"
          status="good"
          value={String(dashboard.metrics.totalTickets)}
        />
        <StatCard
          detail="Currently open"
          icon={<AlertCircle className="size-5" />}
          label="Open"
          status={dashboard.metrics.openTickets > 0 ? "watch" : "good"}
          value={String(dashboard.metrics.openTickets)}
        />
        <StatCard
          detail="Awaiting response"
          icon={<Clock className="size-5" />}
          label="Pending"
          status={dashboard.metrics.pendingTickets > 0 ? "watch" : "good"}
          value={String(dashboard.metrics.pendingTickets)}
        />
        <StatCard
          detail="Successfully resolved"
          icon={<CheckCircle className="size-5" />}
          label="Resolved"
          status="good"
          value={String(dashboard.metrics.resolvedTickets)}
        />
        <StatCard
          detail="Closed tickets"
          icon={<CheckCircle className="size-5" />}
          label="Closed"
          status="good"
          value={String(dashboard.metrics.closedTickets)}
        />
        <StatCard
          detail="SLA breaches"
          icon={<AlertCircle className="size-5" />}
          label="SLA Breached"
          status={dashboard.metrics.breachedSla > 0 ? "risk" : "good"}
          value={String(dashboard.metrics.breachedSla)}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_400px]">
        <Card variant="elevated" className="overflow-hidden rounded-[28px] border-border/70">
          <CardHeader className="border-b border-border/60 bg-gradient-to-r from-surface to-surface-muted/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Ticket Queue</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight md:text-[2rem]">Support Tickets</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Review every customer issue with clearer ownership, cleaner escalation cues, and fast inline actions.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <QueueHighlight
                  icon={<MessageSquare className="size-4" />}
                  label="Recent conversations"
                  value={String(dashboard.tickets.length)}
                />
                <QueueHighlight
                  icon={<Users className="size-4" />}
                  label="Assigned tickets"
                  value={String(assignedCount)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-6">
            {dashboard.tickets.length === 0 ? (
              <EmptyState simple text="No support tickets yet. Create your first ticket to get started." />
            ) : (
              dashboard.tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-[24px] border border-border/70 bg-gradient-to-br from-background via-surface to-surface-muted/70 p-5 shadow-[0_18px_65px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                            Ticket #{ticket.ticket_number}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                            <ArrowUpRight className="size-3" />
                            {formatDateLabel(ticket.created_at)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <h4 className="text-xl font-black tracking-tight text-foreground">{ticket.subject}</h4>
                          <PriorityRail priority={ticket.priority} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <TicketStatusBadge status={ticket.status} />
                          <TicketPriorityBadge priority={ticket.priority} />
                          {ticket.sla_breached ? (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-red-700">
                              SLA breached
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <MetaCard label="Customer" value={ticket.customer_name} helper={ticket.customer_email ?? "No email shared"} />
                          <MetaCard label="Assignee" value={ticket.assigned_to ?? "Unassigned"} helper={ticket.assigned_to ? "Owner confirmed" : "Needs routing"} />
                          <MetaCard
                            label="Messages"
                            value={String(ticket.messages?.length ?? 0)}
                            helper={(ticket.messages?.length ?? 0) > 0 ? "Conversation active" : "Awaiting first response"}
                          />
                        </div>
                      </div>
                    </div>

                    {ticket.description ? (
                      <div className="rounded-2xl border border-border/60 bg-surface/75 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Issue Summary</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{ticket.description}</p>
                      </div>
                    ) : null}

                    {ticket.status !== "closed" ? (
                      <div className="grid gap-3 xl:grid-cols-3">
                        <TicketActionPanel title="Update Status" description="Move the case through the response workflow.">
                          <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
                        </TicketActionPanel>
                        <TicketActionPanel title="Assign Owner" description="Set the accountable staff member for follow-up.">
                          <AssignTicketForm ticketId={ticket.id} currentAssignee={ticket.assigned_to} />
                        </TicketActionPanel>
                        <TicketActionPanel title="Add Message" description="Capture an update or internal note for the case.">
                          <TicketMessageForm ticketId={ticket.id} />
                        </TicketActionPanel>
                      </div>
                    ) : null}

                    {ticket.messages && ticket.messages.length > 0 ? (
                      <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Latest Messages</p>
                          <p className="text-xs font-semibold text-muted-foreground">
                            Showing {Math.min(ticket.messages.length, 5)} of {ticket.messages.length}
                          </p>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {ticket.messages.slice(0, 5).map((msg) => (
                            <div key={msg.id} className="rounded-2xl border border-border/60 bg-surface p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold text-foreground">{msg.sender_name}</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                  {formatDateLabel(msg.created_at)}
                                </p>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{msg.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card variant="elevated" className="overflow-hidden rounded-[28px] border-border/70">
            <CardHeader className="border-b border-border/60 bg-gradient-to-br from-surface to-surface-muted/70">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">New Request</p>
              <h3 className="text-2xl font-black tracking-tight">Create Support Ticket</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Capture a clear subject, customer context, and initial routing so the team can act without back-and-forth.
              </p>
            </CardHeader>
            <CardContent className="p-5 md:p-6">
              <CreateTicketForm />
            </CardContent>
          </Card>

          <Card variant="glow" className="rounded-[28px] border-accent/15">
            <CardHeader>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Operational Guidance</p>
              <h3 className="text-xl font-black tracking-tight">Enterprise support rhythm</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <GuidanceRow
                title="Triage first"
                description="Check breached and pending cases before routine inquiries to protect service levels."
              />
              <GuidanceRow
                title="Keep ownership explicit"
                description="Every live case should show either an assignee or a clear next routing decision."
              />
              <GuidanceRow
                title="Close the communication loop"
                description="Resolved work should end with a customer-visible update, not only an internal status change."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "amber" | "rose" | "emerald";
}) {
  const toneClass = {
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-4 backdrop-blur ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em]">{label}</p>
        <div className="rounded-full bg-white/10 p-2">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
      <p className="text-sm text-slate-300/85">{label}</p>
      <p className="text-lg font-black text-white">{value}</p>
    </div>
  );
}

function QueueHighlight({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function MetaCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-black text-foreground">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</p>
    </div>
  );
}

function TicketActionPanel({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/80 p-4">
      <p className="text-sm font-black text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function GuidanceRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
      <p className="text-sm font-black text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function PriorityRail({ priority }: { priority: string }) {
  const tone = {
    urgent: "from-red-500 to-rose-600",
    high: "from-amber-500 to-orange-600",
    medium: "from-sky-500 to-cyan-600",
    low: "from-emerald-500 to-green-600"
  }[priority] ?? "from-slate-500 to-slate-600";

  return (
    <span className={`inline-flex h-2.5 w-20 rounded-full bg-gradient-to-r ${tone}`} aria-hidden="true" />
  );
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
