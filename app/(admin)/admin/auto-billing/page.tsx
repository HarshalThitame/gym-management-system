import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, CreditCard, Filter, RefreshCcw, Search, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/features/billing/lib/money";
import { AdminAutoBillingActions } from "@/features/billing/components/admin-auto-billing-actions";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Auto-Billing Management",
  description: "Manage recurring billing, subscriptions, and automatic membership renewals.",
  path: "/admin/auto-billing",
});

const PAGE_SIZE = 20;

type SearchParams = Promise<{ q?: string; renew?: string; page?: string }>;

type AutoBillingRow = {
  memberId: string;
  membershipId: string;
  memberName: string;
  memberEmail: string | null;
  planName: string;
  autoRenew: boolean;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  paymentMethod: string | null;
  amount: number;
  nextChargeAt: string | null;
  lastChargedAt: string | null;
  failureCount: number;
};

function buildQueryString(q: string, renew: string, page: number): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (renew) p.set("renew", renew);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function AdminAutoBillingPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/auto-billing");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "auto_billing",
    actionName: "admin.auto-billing.read",
  });

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const searchQuery = params.q?.trim() || "";
  const renewFilter = params.renew || "";

  let matchedMemberIds: string[] | undefined;
  if (searchQuery) {
    const { data: matched } = await supabase
      .from("members")
      .select("id")
      .eq("gym_id", scope.gymId)
      .ilike("full_name", `%${searchQuery}%`) as never as {
      data: Array<{ id: string }> | null;
      error: unknown;
    };
    matchedMemberIds = (matched ?? []).map((m) => m.id);
  }

  let membershipsQuery = supabase
    .from("memberships")
    .select("id, member_id, membership_plan_id, auto_renew, total_amount, status, end_date", { count: "exact" })
    .eq("gym_id", scope.gymId)
    .in("status", ["active", "suspended"]);

  if (renewFilter === "enabled") membershipsQuery = membershipsQuery.eq("auto_renew", true);
  if (renewFilter === "disabled") membershipsQuery = membershipsQuery.eq("auto_renew", false);

  if (searchQuery && matchedMemberIds && matchedMemberIds.length > 0) {
    membershipsQuery = membershipsQuery.in("member_id", matchedMemberIds);
  } else if (searchQuery) {
    membershipsQuery = membershipsQuery.in("member_id", [""]);
  }

  const { data: memberships, count: totalCount } = await membershipsQuery
    .range(offset, offset + PAGE_SIZE - 1)
    .order("created_at", { ascending: false }) as never as {
    data: Array<{
      id: string;
      member_id: string;
      membership_plan_id: string;
      auto_renew: boolean;
      total_amount: number;
      status: string;
      end_date: string;
    }> | null;
    count: number | null;
    error: unknown;
  };

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);
  const memberIds = [...new Set((memberships ?? []).map((m) => m.member_id))];
  const planIds = [...new Set((memberships ?? []).map((m) => m.membership_plan_id))];

  const [{ data: members }, { data: plans }, { data: subs }, { data: paymentMethods }] = await Promise.all([
    memberIds.length > 0
      ? supabase.from("members").select("id, full_name, email").in("id", memberIds) as never as {
          data: Array<{ id: string; full_name: string; email: string | null }> | null;
          error: unknown;
        }
      : { data: [] as Array<{ id: string; full_name: string; email: string | null }> },
    planIds.length > 0
      ? supabase.from("membership_plans").select("id, name").in("id", planIds) as never as {
          data: Array<{ id: string; name: string }> | null;
          error: unknown;
        }
      : { data: [] as Array<{ id: string; name: string }> },
    memberIds.length > 0
      ? supabase.from("member_subscriptions").select("*").in("member_id", memberIds) as never as {
          data: Array<{ id: string; member_id: string; status: string; amount: number; next_charge_at: string | null; last_charged_at: string | null; failure_count: number }> | null;
          error: unknown;
        }
      : { data: [] as Array<{ id: string; member_id: string; status: string; amount: number; next_charge_at: string | null; last_charged_at: string | null; failure_count: number }> },
    memberIds.length > 0
      ? supabase.from("member_payment_methods").select("member_id, display_name, last_four").in("member_id", memberIds) as never as {
          data: Array<{ member_id: string; display_name: string; last_four: string | null }> | null;
          error: unknown;
        }
      : { data: [] as Array<{ member_id: string; display_name: string; last_four: string | null }> },
  ]);

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
  const planMap = new Map((plans ?? []).map((p) => [p.id, p.name]));
  const subMap = new Map<string, typeof subs[0]>();
  for (const s of subs ?? []) { if (!subMap.has(s.member_id)) subMap.set(s.member_id, s); }
  const pmMap = new Map<string, string>();
  for (const pm of paymentMethods ?? []) { if (!pmMap.has(pm.member_id)) pmMap.set(pm.member_id, `${pm.display_name}${pm.last_four ? ` (${pm.last_four})` : ""}`); }

  const rows: AutoBillingRow[] = (memberships ?? []).map((m) => {
    const sub = subMap.get(m.member_id);
    return {
      memberId: m.member_id,
      membershipId: m.id,
      memberName: memberMap.get(m.member_id)?.full_name ?? "Unknown",
      memberEmail: memberMap.get(m.member_id)?.email ?? null,
      planName: planMap.get(m.membership_plan_id) ?? "Unknown",
      autoRenew: m.auto_renew,
      subscriptionStatus: sub?.status ?? null,
      subscriptionId: sub?.id ?? null,
      paymentMethod: pmMap.get(m.member_id) ?? null,
      amount: m.total_amount,
      nextChargeAt: sub?.next_charge_at ?? m.end_date ?? null,
      lastChargedAt: sub?.last_charged_at ?? null,
      failureCount: sub?.failure_count ?? 0,
    };
  });

  const { data: agg } = await supabase.from("memberships").select("auto_renew")
    .eq("gym_id", scope.gymId).in("status", ["active", "suspended"]) as never as {
    data: Array<{ auto_renew: boolean }> | null;
    error: unknown;
  };
  const totalAutoRenew = (agg ?? []).filter((m) => m.auto_renew).length;
  const totalMembers = (agg ?? []).length;
  const hasActiveFilters = !!searchQuery || !!renewFilter;

  function pageHref(p: number) {
    return `/admin/auto-billing${buildQueryString(searchQuery, renewFilter, p)}`;
  }

  const paginationPages: Array<number | "ellipsis"> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) paginationPages.push(i);
  } else {
    paginationPages.push(1);
    if (currentPage > 3) paginationPages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) paginationPages.push(i);
    if (currentPage < totalPages - 2) paginationPages.push("ellipsis");
    paginationPages.push(totalPages);
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Billing Automation</p>
        <h2 className="mt-2 text-3xl font-black">Auto-Billing &amp; Subscriptions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Monitor recurring billing, member subscriptions, and automatic membership renewals.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard detail="Members with auto-renew enabled" icon={<RefreshCcw className="size-5" />} label="Auto-Renew Enabled" value={String(totalAutoRenew)} />
        <StatCard detail="Active recurring subscriptions" icon={<CreditCard className="size-5" />} label="Active Subscriptions" value={String(rows.filter((r) => r.subscriptionStatus === "active").length)} />
        <StatCard detail="Total active members" icon={<UsersRound className="size-5" />} label="Total Members" value={String(totalMembers)} />
        <StatCard detail="Total failed charge attempts" icon={<RefreshCcw className="size-5" />} label="Failed Charges" value={String(rows.reduce((s, r) => s + r.failureCount, 0))} />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_auto_auto]" method="get">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm"
                name="q"
                placeholder="Search member name..."
                defaultValue={searchQuery}
              />
            </div>
            <select className="h-11 rounded-md border border-border bg-surface px-3 text-sm" name="renew" defaultValue={renewFilter || "all"}>
              <option value="all">All members</option>
              <option value="enabled">Auto-renew enabled</option>
              <option value="disabled">Auto-renew disabled</option>
            </select>
            <button className="flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground" type="submit">
              <Filter className="size-4" />
              Apply
            </button>
            {hasActiveFilters ? (
              <a href="/admin/auto-billing" className="flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted">Clear</a>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Members &amp; Billing Status</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {hasActiveFilters ? `${totalCount ?? 0} result${(totalCount ?? 0) === 1 ? "" : "s"} — clear filters to see all` : "All memberships with their auto-renewal and subscription status."}
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState simple text={hasActiveFilters ? "No members match your search or filter criteria." : "No memberships found for this gym."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="pb-3 pr-4">Member</th>
                    <th className="pb-3 pr-4">Plan</th>
                    <th className="pb-3 pr-4">Auto-Renew</th>
                    <th className="pb-3 pr-4">Subscription</th>
                    <th className="pb-3 pr-4">Payment Method</th>
                    <th className="pb-3 pr-4 text-right">Amount</th>
                    <th className="pb-3 pr-4">Next Charge</th>
                    <th className="pb-3 pr-4 text-right">Failures</th>
                    <th className="pb-3 pl-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-semibold">{row.memberName}</p>
                        {row.memberEmail ? <p className="text-xs text-muted-foreground">{row.memberEmail}</p> : null}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.planName}</td>
                      <td className="py-3 pr-4">{row.autoRenew ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}</td>
                      <td className="py-3 pr-4">
                        {row.subscriptionStatus ? (
                          <Badge variant={row.subscriptionStatus === "active" ? "success" : row.subscriptionStatus === "failed" ? "error" : "warning"}>
                            {row.subscriptionStatus}
                          </Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.paymentMethod || "—"}</td>
                      <td className="py-3 pr-4 text-right font-semibold">{formatCurrency(row.amount)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {row.nextChargeAt ? new Date(row.nextChargeAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {row.failureCount > 0 ? <span className="font-semibold text-red-600">{row.failureCount}</span> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="py-3 pl-2">
                        <AdminAutoBillingActions
                          memberId={row.memberId}
                          membershipId={row.membershipId}
                          autoRenew={row.autoRenew}
                          hasActiveSubscription={row.subscriptionStatus === "active"}
                          subscriptionId={row.subscriptionId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <ButtonLink href={pageHref(currentPage - 1)} size="sm" variant="ghost" aria-disabled={currentPage <= 1}
              className={currentPage <= 1 ? "pointer-events-none opacity-30" : ""}>
              <ChevronLeft className="size-4" />
            </ButtonLink>
            {paginationPages.map((p, i) =>
              p === "ellipsis"
                ? <span key={`e-${i}`} className="flex size-10 items-center justify-center text-sm text-muted-foreground">&hellip;</span>
                : <ButtonLink key={p} href={pageHref(p)} size="sm" variant={p === currentPage ? "primary" : "ghost"}>{p}</ButtonLink>
            )}
            <ButtonLink href={pageHref(currentPage + 1)} size="sm" variant="ghost" aria-disabled={currentPage >= totalPages}
              className={currentPage >= totalPages ? "pointer-events-none opacity-30" : ""}>
              <ChevronRight className="size-4" />
            </ButtonLink>
          </div>
          <span className="text-sm text-muted-foreground">{totalCount ?? 0} total</span>
        </nav>
      )}
    </div>
  );
}
