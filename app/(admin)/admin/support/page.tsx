import type { Metadata } from "next";
import { LifeBuoy, AlertCircle, CheckCircle, Clock, MessageSquare, Users } from "lucide-react";
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

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Customer Support</p>
        <h2 className="mt-2 text-3xl font-black">Support Center</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage customer support tickets, track response times, and ensure timely resolution of issues.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          detail="Total support tickets"
          icon={<LifeBuoy className="size-5" />}
          label="Total Tickets"
          value={String(dashboard.metrics.totalTickets)}
        />
        <StatCard
          detail="Currently open"
          icon={<AlertCircle className="size-5" />}
          label="Open"
          value={String(dashboard.metrics.openTickets)}
        />
        <StatCard
          detail="Awaiting response"
          icon={<Clock className="size-5" />}
          label="Pending"
          value={String(dashboard.metrics.pendingTickets)}
        />
        <StatCard
          detail="Successfully resolved"
          icon={<CheckCircle className="size-5" />}
          label="Resolved"
          value={String(dashboard.metrics.resolvedTickets)}
        />
        <StatCard
          detail="Closed tickets"
          icon={<CheckCircle className="size-5" />}
          label="Closed"
          value={String(dashboard.metrics.closedTickets)}
        />
        <StatCard
          detail="SLA breaches"
          icon={<AlertCircle className="size-5" />}
          label="SLA Breached"
          value={String(dashboard.metrics.breachedSla)}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Support Tickets</h3>
            <p className="text-sm leading-6 text-muted-foreground">All customer support tickets.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.tickets.length === 0 ? (
              <EmptyState simple text="No support tickets yet. Create your first ticket to get started." />
            ) : (
              dashboard.tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-lg border border-border bg-surface-muted p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black">{ticket.subject}</h4>
                        <TicketStatusBadge status={ticket.status} />
                        <TicketPriorityBadge priority={ticket.priority} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {ticket.customer_name} {ticket.customer_email ? `· ${ticket.customer_email}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        Ticket #{ticket.ticket_number} · Created {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                      {ticket.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{ticket.description}</p>
                      )}
                      {ticket.sla_breached && (
                        <p className="mt-1 text-xs font-bold text-destructive">
                          SLA Breached
                        </p>
                      )}
                      {ticket.assigned_to && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Assigned to: {ticket.assigned_to}
                        </p>
                      )}
                    </div>
                  </div>

                  {ticket.status !== "closed" && (
                    <div className="mt-4 space-y-3">
                      <details className="rounded-md border border-border bg-surface p-3">
                        <summary className="cursor-pointer text-xs font-black">Update Status</summary>
                        <div className="mt-3">
                          <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
                        </div>
                      </details>
                      <details className="rounded-md border border-border bg-surface p-3">
                        <summary className="cursor-pointer text-xs font-black">Assign Ticket</summary>
                        <div className="mt-3">
                          <AssignTicketForm ticketId={ticket.id} currentAssignee={ticket.assigned_to} />
                        </div>
                      </details>
                      <details className="rounded-md border border-border bg-surface p-3">
                        <summary className="cursor-pointer text-xs font-black">Add Message</summary>
                        <div className="mt-3">
                          <TicketMessageForm ticketId={ticket.id} />
                        </div>
                      </details>
                    </div>
                  )}

                  {ticket.messages && ticket.messages.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Messages</p>
                      {ticket.messages.slice(0, 5).map((msg) => (
                        <div key={msg.id} className="rounded-md border border-border bg-surface p-2">
                          <p className="text-xs text-muted-foreground">{msg.body}</p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            {msg.sender_name} · {new Date(msg.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Create Support Ticket</h3>
          </CardHeader>
          <CardContent>
            <CreateTicketForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
