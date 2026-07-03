import type { Metadata } from "next";
import { ArrowLeft, Phone, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { getLeadDashboard } from "@/features/leads/services/lead-service";
import { LeadStatusBadge } from "@/features/leads/components/lead-forms";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Leads Report",
  description: "Lead pipeline and conversion report for front desk.",
  path: "/reception/reports/leads"
});

export default async function LeadsReportPage() {
  const scope = await requireReceptionScope("/reception/reports/leads");
  const dashboard = await getLeadDashboard(scope.gymId, {
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
  });

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/reports" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reports</p>
          <h2 className="text-2xl font-black">Leads Report</h2>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total leads" icon={<Phone className="size-5" />} label="Total Leads" value={String(dashboard.metrics.totalLeads)} />
        <StatCard detail="New leads" icon={<Phone className="size-5" />} label="New" value={String(dashboard.metrics.newLeads)} />
        <StatCard detail="Converted" icon={<TrendingUp className="size-5" />} label="Converted" value={String(dashboard.metrics.convertedLeads)} />
        <StatCard detail="Lost leads" icon={<Phone className="size-5" />} label="Lost" value={String(dashboard.metrics.lostLeads)} />
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Lead Pipeline</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.recentLeads.map((lead) => (
            <div className="rounded-md border border-border bg-surface p-4" key={lead.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{lead.name}</p>
                    <LeadStatusBadge status={lead.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {lead.phone} · Source: {lead.source.replaceAll("_", " ")}
                    {" · "}{new Date(lead.created_at).toLocaleDateString("en-IN")}
                  </p>
                  {lead.interest ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">Interest: {lead.interest}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {dashboard.recentLeads.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
              No leads found.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
