import type { Metadata } from "next";
import { Calendar, Pause, PlayCircle, RefreshCcw, ShieldAlert, Timer, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listActiveMembershipPlans } from "@/features/memberships/services/membership-service";
import {
  renewMembershipFrontDeskAction,
  freezeMembershipFrontDeskAction,
  cancelMembershipFrontDeskAction
} from "@/features/memberships/actions/reception-membership-actions";

export const metadata: Metadata = createMetadata({
  title: "Reception Memberships",
  description: "Manage membership renewals, freezes, cancellations, and status updates.",
  path: "/reception/memberships"
});

export default async function ReceptionMembershipsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const scope = await requireReceptionScope("/reception/memberships");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("memberships")
    .select(`
      *,
      member:members!inner(id, full_name, phone, email, member_code),
      plan:membership_plans(id, name, duration_days)
    `)
    .eq("gym_id", scope.gymId)
    .order("end_date", { ascending: true })
    .limit(25);

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const [{ data: memberships }, plansResult] = await Promise.all([
    query,
    listActiveMembershipPlans(scope.gymId)
  ]);

  const countQuery = supabase
    .from("memberships")
    .select("id, status", { count: "exact" })
    .eq("gym_id", scope.gymId);

  const { data: allMemberships } = await countQuery;

  const allData = allMemberships ?? [];
  const active = allData.filter((m) => m.status === "active").length;
  const frozen = allData.filter((m) => m.status === "frozen").length;
  const expired = allData.filter((m) => m.status === "expired").length;
  const pending = allData.filter((m) => m.status === "pending").length;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Memberships</p>
        <h2 className="mt-2 text-3xl font-black">Membership operations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          View and manage membership status, renewals, freezes, and cancellations for assigned branch members.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Active memberships" icon={<PlayCircle className="size-5" />} label="Active" value={String(active)} />
        <StatCard detail="Frozen memberships" icon={<Timer className="size-5" />} label="Frozen" value={String(frozen)} />
        <StatCard detail="Expired memberships" icon={<Calendar className="size-5" />} label="Expired" value={String(expired)} />
        <StatCard detail="Pending activation" icon={<ShieldAlert className="size-5" />} label="Pending" value={String(pending)} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-2xl font-black">Membership Records</h3>
            <form className="flex gap-2" method="get">
              <select aria-label="Filter by status" className="h-11 rounded-md border border-border bg-surface px-3" defaultValue={params.status ?? "all"} name="status">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="frozen">Frozen</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
                <option value="pending">Pending</option>
              </select>
              <button className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground" type="submit">
                Filter
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships?.map((membership: Record<string, unknown>) => {
            const member = membership.member as Record<string, unknown> | null;
            const plan = membership.plan as Record<string, unknown> | null;
            const status = (membership.status as string) ?? "unknown";
            const membershipId = membership.id as string;
            return (
              <div className="rounded-md border border-border bg-surface p-4" key={membershipId}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{member?.full_name as string ?? "Unknown"}</p>
                      <MembershipStatusBadge status={status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {member?.member_code as string ?? "N/A"} · {member?.phone as string ?? "N/A"}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      Plan: {plan?.name as string ?? "N/A"}
                      {" · "}Expires: {new Date(membership.end_date as string).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(status === "active" || status === "expired") ? (
                      <form action={renewMembershipFrontDeskAction} className="flex items-center gap-2">
                        <input name="membershipId" type="hidden" value={membershipId} />
                        <select
                          aria-label="Select plan"
                          className="h-8 rounded-md border border-border bg-surface-muted px-2 text-xs font-semibold"
                          defaultValue={plan?.id as string ?? plansResult[0]?.id}
                          name="planId"
                        >
                          {plansResult.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} ({plan.duration_days}d)
                            </option>
                          ))}
                        </select>
                        <input name="durationDays" type="hidden" value={plan?.duration_days as number ?? 30} />
                        <button
                          className="inline-flex items-center gap-1 rounded-md bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30"
                          type="submit"
                        >
                          <RefreshCcw className="size-3" />
                          Renew
                        </button>
                      </form>
                    ) : null}
                    {status === "active" ? (
                      <form action={freezeMembershipFrontDeskAction}>
                        <input name="membershipId" type="hidden" value={membershipId} />
                        <input name="reason" type="hidden" value="Front desk freeze request" />
                        <button
                          className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/30"
                          type="submit"
                        >
                          <Pause className="size-3" />
                          Freeze
                        </button>
                      </form>
                    ) : null}
                    {status === "active" || status === "frozen" ? (
                      <form action={cancelMembershipFrontDeskAction}>
                        <input name="membershipId" type="hidden" value={membershipId} />
                        <input name="reason" type="hidden" value="Front desk cancellation request" />
                        <button
                          className="inline-flex items-center gap-1 rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/30"
                          type="submit"
                        >
                          <X className="size-3" />
                          Cancel
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {!memberships?.length ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
              No membership records found.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MembershipStatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "border-green-500/40 text-green-400" },
    frozen: { label: "Frozen", className: "border-amber-500/40 text-amber-400" },
    expired: { label: "Expired", className: "border-red-500/40 text-red-400" },
    cancelled: { label: "Cancelled", className: "border-slate-500/40 text-slate-400" },
    pending: { label: "Pending", className: "border-blue-500/40 text-blue-400" },
    suspended: { label: "Suspended", className: "border-orange-500/40 text-orange-400" }
  };
  const s = statusMap[status] ?? { label: status, className: "border-border text-muted-foreground" };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-black uppercase ${s.className}`}>
      {s.label}
    </span>
  );
}
