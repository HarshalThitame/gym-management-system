import type { Metadata } from "next";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Registrations Report",
  description: "New member registrations report for front desk.",
  path: "/reception/reports/registrations"
});

export default async function RegistrationsReportPage() {
  const scope = await requireReceptionScope("/reception/reports/registrations");
  const result = await listMembers({
    gymId: scope.gymId,
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    pageSize: 50
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayMembers = result.members.filter((m) => m.created_at?.startsWith(today));
  const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekMembers = result.members.filter((m) => (m.created_at ?? "") >= thisWeek);

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/reports" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reports</p>
          <h2 className="text-2xl font-black">Registrations Report</h2>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard detail="Total members" icon={<UserRoundPlus className="size-5" />} label="Total Members" value={String(result.total)} />
        <StatCard detail="Registered today" icon={<UserRoundPlus className="size-5" />} label="Today" value={String(todayMembers.length)} />
        <StatCard detail="This week" icon={<UserRoundPlus className="size-5" />} label="This Week" value={String(weekMembers.length)} />
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Recent Registrations</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.members.slice(0, 25).map((member) => (
            <div className="rounded-md border border-border bg-surface p-4" key={member.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{member.full_name}</p>
                    <Badge variant="neutral">{member.member_code}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {member.phone}{member.email ? ` · ${member.email}` : ""}
                    {" · "}Plan: {member.current_plan?.name ?? "N/A"}
                  </p>
                </div>
                <Badge variant={member.current_membership?.status === "active" ? "success" : "warning"}>
                  {member.current_membership?.status ?? "no membership"}
                </Badge>
              </div>
            </div>
          ))}
          {result.members.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
              No registrations found.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
