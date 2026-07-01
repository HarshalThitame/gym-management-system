import type { Metadata } from "next";
import { Users, TrendingUp, Target, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getCrmDashboard, listLeads } from "@/features/crm/services/crm-service";
import { listActiveMembershipPlans } from "@/features/memberships/services/membership-service";
import {
  LeadForm,
  LeadStatusForm,
  LeadSourceForm,
  LeadStatusUpdateForm,
  FollowupForm,
  ConvertLeadForm,
  MarkLeadLostForm
} from "@/features/crm/components/crm-forms";
import { CrmLeadStatusBadge } from "@/features/crm/components/crm-status-badge";

export const metadata: Metadata = createMetadata({
  title: "CRM & Leads",
  description: "Manage leads, track conversions, and monitor your sales pipeline.",
  path: "/admin/crm"
});

export default async function AdminCrmPage() {
  const scope = await requireGymAdminScope("/admin/crm");
  const [dashboard, plans] = await Promise.all([
    getCrmDashboard(scope.gymId),
    listActiveMembershipPlans(scope.gymId)
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Sales Pipeline</p>
        <h2 className="mt-2 text-3xl font-black">CRM & Lead Management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Track leads from initial contact to conversion. Manage your sales pipeline, assign follow-ups, and convert qualified leads to members.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          detail="Total leads in system"
          icon={<Users className="size-5" />}
          label="Total Leads"
          value={String(dashboard.metrics.totalLeads)}
        />
        <StatCard
          detail="Leads in pipeline"
          icon={<Target className="size-5" />}
          label="Active"
          value={String(dashboard.metrics.activeLeads)}
        />
        <StatCard
          detail="Successfully converted"
          icon={<UserCheck className="size-5" />}
          label="Converted"
          value={String(dashboard.metrics.convertedLeads)}
        />
        <StatCard
          detail="Lost or closed leads"
          icon={<UserX className="size-5" />}
          label="Lost"
          value={String(dashboard.metrics.lostLeads)}
        />
        <StatCard
          detail="Conversion success rate"
          icon={<TrendingUp className="size-5" />}
          label="Conversion Rate"
          value={`${dashboard.metrics.conversionRate.toFixed(1)}%`}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Lead Pipeline</h3>
            <p className="text-sm leading-6 text-muted-foreground">All leads in your sales pipeline.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.leads.length === 0 ? (
              <EmptyState simple text="No leads yet. Create your first lead to get started." />
            ) : (
              dashboard.leads.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-border bg-surface-muted p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black">
                          {lead.first_name} {lead.last_name}
                        </h4>
                        <CrmLeadStatusBadge status={lead.status?.name} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {lead.email ?? "No email"} · {lead.phone ?? "No phone"}
                      </p>
                      {lead.interested_in && lead.interested_in.length > 0 && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Interested in: {lead.interested_in.join(", ")}
                        </p>
                      )}
                      {lead.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{lead.notes}</p>
                      )}
                      {lead.follow_up_date && (
                        <p className="mt-1 text-xs font-bold text-warning">
                          Follow-up: {new Date(lead.follow_up_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {!lead.converted_at && !lead.lost_at && (
                    <div className="mt-4 space-y-3">
                      <details className="rounded-md border border-border bg-surface p-3">
                        <summary className="cursor-pointer text-xs font-black">Update Status</summary>
                        <div className="mt-3">
                          <LeadStatusUpdateForm
                            leadId={lead.id}
                            currentStatusId={lead.status_id}
                            statuses={dashboard.statuses}
                          />
                        </div>
                      </details>
                      <details className="rounded-md border border-border bg-surface p-3">
                        <summary className="cursor-pointer text-xs font-black">Add Follow-up</summary>
                        <div className="mt-3">
                          <FollowupForm leadId={lead.id} />
                        </div>
                      </details>
                      <details className="rounded-md border border-success/30 bg-success/5 p-3">
                        <summary className="cursor-pointer text-xs font-black text-success">Convert to Member</summary>
                        <div className="mt-3">
                          <ConvertLeadForm leadId={lead.id} plans={plans} />
                        </div>
                      </details>
                      <details className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                        <summary className="cursor-pointer text-xs font-black text-destructive">Mark as Lost</summary>
                        <div className="mt-3">
                          <MarkLeadLostForm leadId={lead.id} />
                        </div>
                      </details>
                    </div>
                  )}

                  {lead.converted_at && (
                    <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-3">
                      <p className="text-xs font-bold text-success">
                        Converted on {new Date(lead.converted_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {lead.lost_at && (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-xs font-bold text-destructive">
                        Lost on {new Date(lead.lost_at).toLocaleDateString()}
                      </p>
                      {lead.lost_reason && (
                        <p className="mt-1 text-xs text-muted-foreground">Reason: {lead.lost_reason}</p>
                      )}
                    </div>
                  )}

                  {lead.followups && lead.followups.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Follow-up History</p>
                      {lead.followups.slice(0, 3).map((followup) => (
                        <div key={followup.id} className="rounded-md border border-border bg-surface p-2">
                          <p className="text-xs text-muted-foreground">{followup.notes}</p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            {new Date(followup.created_at).toLocaleDateString()}
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

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Create Lead</h3>
            </CardHeader>
            <CardContent>
              <LeadForm statuses={dashboard.statuses} sources={dashboard.sources} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Lead Statuses</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.statuses.map((status) => (
                <div key={status.id} className="rounded-md border border-border bg-surface-muted p-3">
                  <p className="font-black">{status.name}</p>
                  <p className="text-xs text-muted-foreground">Order: {status.sort_order}</p>
                </div>
              ))}
              <details className="mt-4 rounded-md border border-border bg-surface p-3">
                <summary className="cursor-pointer text-xs font-black">Add Status</summary>
                <div className="mt-3">
                  <LeadStatusForm />
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Lead Sources</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.sources.map((source) => (
                <div key={source.id} className="rounded-md border border-border bg-surface-muted p-3">
                  <p className="font-black">{source.name}</p>
                </div>
              ))}
              <details className="mt-4 rounded-md border border-border bg-surface p-3">
                <summary className="cursor-pointer text-xs font-black">Add Source</summary>
                <div className="mt-3">
                  <LeadSourceForm />
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
