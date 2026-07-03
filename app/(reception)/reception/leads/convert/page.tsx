import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { getLeadById } from "@/features/leads/services/lead-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { listActiveMembershipPlans } from "@/features/memberships/services/membership-service";
import { ConvertLeadForm } from "@/features/leads/components/convert-lead-form";
import { LeadStatusBadge } from "@/features/leads/components/lead-forms";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Convert Lead",
  description: "Convert a lead into a member with an active membership.",
  path: "/reception/leads/convert"
});

type ConvertLeadPageProps = {
  searchParams: Promise<{ leadId?: string }>;
};

export default async function ConvertLeadPage({ searchParams }: ConvertLeadPageProps) {
  const scope = await requireReceptionScope("/reception/leads/convert");
  const params = await searchParams;
  const leadId = params.leadId;

  if (!leadId) return notFound();

  const [lead, plans] = await Promise.all([
    getLeadById(leadId, scope.gymId, {
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    }),
    listActiveMembershipPlans(scope.gymId)
  ]);

  if (!lead) return notFound();

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/leads" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Lead Conversion</p>
          <h2 className="text-2xl font-black">Convert {lead.name}</h2>
        </div>
      </section>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{lead.phone}</span>
            {lead.email ? <span className="text-sm text-muted-foreground">· {lead.email}</span> : null}
            <LeadStatusBadge status={lead.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Source: {lead.source.replaceAll("_", " ")}</p>
          {lead.interest ? <p className="mt-0.5 text-xs text-muted-foreground">Interest: {lead.interest}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Create Member from Lead</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            This will create a new member record, activate a membership, and mark the lead as converted.
          </p>
        </CardHeader>
        <CardContent>
          <ConvertLeadForm leadId={lead.id} leadName={lead.name} plans={plans} />
        </CardContent>
      </Card>
    </div>
  );
}
