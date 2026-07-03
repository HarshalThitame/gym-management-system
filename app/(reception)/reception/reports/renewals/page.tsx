import type { Metadata } from "next";
import { ArrowLeft, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, formatISO } from "date-fns";

export const metadata: Metadata = createMetadata({
  title: "Renewals Report",
  description: "Memberships due for renewal report.",
  path: "/reception/reports/renewals"
});

export default async function RenewalsReportPage() {
  const scope = await requireReceptionScope("/reception/reports/renewals");
  const supabase = await createSupabaseServerClient();
  const today = formatISO(new Date(), { representation: "date" });
  const weekEnd = formatISO(addDays(new Date(), 7), { representation: "date" });

  const { data: renewals } = await supabase
    .from("memberships")
    .select(`
      *,
      member:members!inner(id, full_name, phone, member_code),
      plan:membership_plans(id, name, duration_days)
    `)
    .eq("gym_id", scope.gymId)
    .in("status", ["active", "frozen"])
    .order("end_date", { ascending: true })
    .limit(30);

  const dueList = renewals ?? [];
  const dueNow = dueList.filter((m) => (m.end_date as string) <= weekEnd);
  const expiredList = dueList.filter((m) => (m.end_date as string) < today);

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/reports" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reports</p>
          <h2 className="text-2xl font-black">Renewals Report</h2>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Total active/frozen" icon={<Calendar className="size-5" />} label="Active Membership" value={String(dueList.length)} />
        <StatCard detail="Due in 7 days" icon={<Calendar className="size-5" />} label="Due Soon" value={String(dueNow.length)} />
        <StatCard detail="Already expired" icon={<Calendar className="size-5" />} label="Expired" value={String(expiredList.length)} />
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Renewals Due</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {dueList.map((membership: Record<string, unknown>) => {
            const member = membership.member as Record<string, unknown> | null;
            const plan = membership.plan as Record<string, unknown> | null;
            const endDate = membership.end_date as string;
            const isExpired = endDate < today;
            return (
              <div className="rounded-md border border-border bg-surface p-4" key={membership.id as string}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{member?.full_name as string ?? "Unknown"}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {member?.member_code as string ?? "N/A"} · Plan: {plan?.name as string ?? "N/A"}
                      {" · "}Expires: {new Date(endDate).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Badge variant={isExpired ? "danger-glow" : "warning-glow"}>
                    {isExpired ? "Expired" : "Due Soon"}
                  </Badge>
                </div>
              </div>
            );
          })}
          {dueList.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
              No renewals due at this time.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
