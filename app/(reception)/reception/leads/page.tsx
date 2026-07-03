import type { Metadata } from "next";
import { Phone, TrendingUp, UserRoundPlus, UserRoundCheck, UserRoundX, UsersRound, Zap, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getLeadDashboard } from "@/features/leads/services/lead-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { LeadForm, LeadStatusForm, LeadStatusBadge } from "@/features/leads/components/lead-forms";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Leads",
  description: "Manage leads, follow-ups, trial scheduling, and conversion tracking from the front desk.",
  path: "/reception/leads"
});

const stageStats = [
  { key: "newLeads", label: "New", icon: Zap, color: "text-blue-400" },
  { key: "contactedLeads", label: "Contacted", icon: Phone, color: "text-purple-400" },
  { key: "trialActive", label: "Trial Active", icon: Clock, color: "text-green-400" },
  { key: "convertedLeads", label: "Converted", icon: UserRoundCheck, color: "text-emerald-400" },
  { key: "lostLeads", label: "Lost", icon: UserRoundX, color: "text-red-400" }
] as const;

export default async function ReceptionLeadsPage() {
  const scope = await requireReceptionScope("/reception/leads");
  const dashboard = await getLeadDashboard(scope.gymId, {
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Leads</p>
        <h2 className="mt-2 text-3xl font-black bg-gradient-to-r from-foreground via-accent to-purple-400 bg-clip-text text-transparent">Lead management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage walk-ins, enquiries, trial visits, follow-ups, and lead conversion for assigned branch.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail="Total leads in database"
          icon={<UsersRound className="size-5" />}
          label="Total Leads"
          value={String(dashboard.metrics.totalLeads)}
        />
        <StatCard
          detail="New enquiries today"
          icon={<UserRoundPlus className="size-5" />}
          label="Today's Leads"
          value={String(dashboard.metrics.todayLeads)}
        />
        <StatCard
          detail="Requiring follow-up"
          icon={<Phone className="size-5" />}
          label="Need Follow-Up"
          value={String(dashboard.metrics.newLeads + dashboard.metrics.contactedLeads)}
        />
        <StatCard
          detail="Conversion rate"
          icon={<TrendingUp className="size-5" />}
          label="Converted"
          value={String(dashboard.metrics.convertedLeads)}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {stageStats.map((stage) => (
          <StatCard
            detail={`${stage.label} leads`}
            icon={<stage.icon className={`size-5 ${stage.color}`} />}
            key={stage.key}
            label={stage.label}
            value={String(dashboard.metrics[stage.key])}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Recent Leads</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentLeads.map((lead) => (
              <div className="rounded-md border border-border bg-surface p-4" key={lead.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{lead.name}</p>
                      <LeadStatusBadge status={lead.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">
                      {lead.phone}{lead.email ? ` · ${lead.email}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      Source: {lead.source.replaceAll("_", " ")} · {new Date(lead.created_at).toLocaleString("en-IN")}
                    </p>
                    {lead.interest ? (
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        Interest: {lead.interest}
                      </p>
                    ) : null}
                    {lead.message ? (
                      <p className="mt-1 text-xs text-muted-foreground">{lead.message.slice(0, 150)}</p>
                    ) : null}
                  </div>
                  <LeadStatusForm lead={lead} />
                  {lead.status !== "converted" ? (
                    <a
                      className="inline-flex items-center gap-1 rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-bold text-green-400 hover:bg-green-500/30"
                      href={`/reception/leads/convert?leadId=${lead.id}`}
                    >
                      Convert
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {dashboard.recentLeads.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
                No leads have been captured yet.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Quick Lead Entry</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Capture a new walk-in or enquiry lead.
              </p>
            </CardHeader>
            <CardContent>
              <LeadForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Follow-Ups Needed</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.followUps.map((lead) => (
                <div className="rounded-md border border-border bg-surface-muted p-4" key={lead.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{lead.name}</p>
                        <LeadStatusBadge status={lead.status} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {lead.phone} · Source: {lead.source.replaceAll("_", " ")}
                      </p>
                      {lead.preferred_trial_at ? (
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          Trial: {new Date(lead.preferred_trial_at).toLocaleString("en-IN")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {dashboard.followUps.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
                  No follow-ups pending.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </section>
    </div>
  );
}
