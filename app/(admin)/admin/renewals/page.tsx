import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, Clock, Mail, RefreshCcw, Search, UserRound, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Membership Renewals",
  description: "Monitor upcoming renewals, overdue memberships, and failed payment retries.",
  path: "/admin/renewals",
});

type SearchParams = Promise<{ q?: string; tab?: string; page?: string }>;

const PAGE_SIZE = 20;
const TABS = ["due", "overdue", "failed"] as const;

type RenewalRow = {
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  membershipId: string;
  planName: string;
  endDate: string | null;
  amount: number;
  autoRenew: boolean;
  dunningStatus: string | null;
  daysRemaining: number;
};

type FailedRow = {
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  dunningAttempts: number;
  lastFailure: string | null;
  daysSinceFailure: number;
};

export default async function AdminRenewalsPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/renewals");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "membership_renewals",
    actionName: "admin.renewals.read",
  });

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const searchQuery = params.q?.trim() || "";
  const activeTab = TABS.includes((params.tab || "due") as typeof TABS[number]) ? (params.tab as typeof TABS[number]) : "due";

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

  // Aggregate stats across all tabs
  const { data: allMemberships } = await supabase
    .from("memberships")
    .select("id, member_id, membership_plan_id, status, end_date, auto_renew, total_amount")
    .eq("gym_id", scope.gymId) as never as {
    data: Array<{ id: string; member_id: string; membership_plan_id: string; status: string; end_date: string | null; auto_renew: boolean; total_amount: number }> | null;
    error: unknown;
  };

  const dueCount = (allMemberships ?? []).filter((m) => {
    if (m.status !== "active") return false;
    if (!m.end_date) return false;
    return m.end_date >= todayStr && m.end_date <= thirtyDaysStr;
  }).length;

  const overdueCount = (allMemberships ?? []).filter((m) => {
    if (m.status !== "active" && m.status !== "suspended") return false;
    if (!m.end_date) return false;
    return m.end_date < todayStr;
  }).length;

  const { data: failedInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("gym_id", scope.gymId)
    .eq("dunning_status", "failed") as never as {
    data: Array<{ id: string }> | null;
    error: unknown;
  };
  const failedCount = failedInvoices?.length ?? 0;

  const renewedThisMonth = (allMemberships ?? []).filter((m) => {
    if (m.status !== "active") return false;
    return true;
  }).length;

  // Build search filter for member name lookup
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

  function applyMemberFilter<T extends { member_id: string }>(items: T[]): T[] {
    if (!searchQuery || !matchedMemberIds) return items;
    return items.filter((item) => matchedMemberIds!.includes(item.member_id));
  }

  // === TAB 1: Due for Renewal ===
  let dueQuery = supabase
    .from("memberships")
    .select("id, member_id, membership_plan_id, status, end_date, auto_renew, total_amount", { count: "exact" })
    .eq("gym_id", scope.gymId)
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", thirtyDaysStr);

  const { data: dueMemberships, count: dueTotal } = await dueQuery
    .order("end_date", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{ id: string; member_id: string; membership_plan_id: string; status: string; end_date: string | null; auto_renew: boolean; total_amount: number }> | null;
    count: number | null;
    error: unknown;
  };

  // === TAB 2: Overdue/Expired ===
  let overdueQuery = supabase
    .from("memberships")
    .select("id, member_id, membership_plan_id, status, end_date, auto_renew, total_amount", { count: "exact" })
    .eq("gym_id", scope.gymId)
    .in("status", ["active", "suspended"])
    .lt("end_date", todayStr);

  const { data: overdueMemberships, count: overdueTotal } = await overdueQuery
    .order("end_date", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{ id: string; member_id: string; membership_plan_id: string; status: string; end_date: string | null; auto_renew: boolean; total_amount: number }> | null;
    count: number | null;
    error: unknown;
  };

  // === TAB 3: Failed Payments ===
  let failedQuery = supabase
    .from("invoices")
    .select("id, invoice_number, member_id, total_amount, amount_due, dunning_attempts, dunning_last_failure_reason, dunning_status, dunning_last_attempt_at", { count: "exact" })
    .eq("gym_id", scope.gymId)
    .eq("dunning_status", "failed");

  const { data: failedInvoicesData, count: failedTotal } = await failedQuery
    .order("dunning_last_attempt_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{
      id: string; invoice_number: string; member_id: string;
      total_amount: number | null; amount_due: number;
      dunning_attempts: number; dunning_last_failure_reason: string | null;
      dunning_status: string | null; dunning_last_attempt_at: string | null;
    }> | null;
    count: number | null;
    error: unknown;
  };

  // Resolve member names
  const allMemberIds = [
    ...new Set([
      ...(dueMemberships ?? []).map((m) => m.member_id),
      ...(overdueMemberships ?? []).map((m) => m.member_id),
      ...(failedInvoicesData ?? []).map((m) => m.member_id),
    ]),
  ];

  const { data: members } = allMemberIds.length > 0
    ? await supabase.from("members").select("id, full_name, email").in("id", allMemberIds) as never as {
        data: Array<{ id: string; full_name: string; email: string | null }> | null;
        error: unknown;
      }
    : { data: [] as Array<{ id: string; full_name: string; email: string | null }> };

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

  // Resolve plan names
  const allPlanIds = [
    ...new Set([
      ...(dueMemberships ?? []).map((m) => m.membership_plan_id),
      ...(overdueMemberships ?? []).map((m) => m.membership_plan_id),
    ]),
  ];

  const { data: plans } = allPlanIds.length > 0
    ? await supabase.from("membership_plans").select("id, name").in("id", allPlanIds) as never as {
        data: Array<{ id: string; name: string }> | null;
        error: unknown;
      }
    : { data: [] as Array<{ id: string; name: string }> };

  const planMap = new Map((plans ?? []).map((p) => [p.id, p.name]));

  function calcDays(dateStr: string | null): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const hasActiveFilters = !!searchQuery;
  const activeCount = activeTab === "due" ? (dueTotal ?? 0) : activeTab === "overdue" ? (overdueTotal ?? 0) : (failedTotal ?? 0);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Membership Operations</p>
        <h2 className="mt-2 text-3xl font-black">Renewals &amp; Expirations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Monitor upcoming renewals, overdue memberships, and failed payment retries. All data is live from the database.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Memberships expiring within 30 days" icon={<CalendarClock className="size-5" />} label="Due This Week" value={String(dueCount)} />
        <StatCard detail="Expired memberships not yet renewed" icon={<AlertTriangle className="size-5" />} label="Overdue" value={String(overdueCount)} />
        <StatCard detail="Invoices where dunning was exhausted" icon={<Clock className="size-5" />} label="Failed Renewals" value={String(failedCount)} />
        <StatCard detail="Currently active members" icon={<UsersRound className="size-5" />} label="Active Members" value={String(renewedThisMonth)} />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <form className="flex flex-1 items-center gap-2" method="get">
              <input type="hidden" name="tab" value={activeTab} />
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm" name="q" placeholder="Search member name..." defaultValue={searchQuery} />
              </div>
              <button className="flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground" type="submit">Search</button>
              {hasActiveFilters ? <a href={`/admin/renewals?tab=${activeTab}`} className="flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted">Clear</a> : null}
            </form>
            <nav className="flex gap-1 rounded-md border border-border p-1">
              {TABS.map((tab) => (
                <a key={tab} href={`/admin/renewals?tab=${tab}${searchQuery ? `&q=${searchQuery}` : ""}`}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {tab === "due" ? "Due" : tab === "overdue" ? "Overdue" : "Failed"}
                </a>
              ))}
            </nav>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-black">
                {activeTab === "due" ? "Due for Renewal" : activeTab === "overdue" ? "Overdue / Expired" : "Failed Payments"}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {activeTab === "due" ? `Memberships expiring within the next 30 days. ${hasActiveFilters ? `${activeCount} results` : ""}` : ""}
                {activeTab === "overdue" ? `Memberships past their end date. ${hasActiveFilters ? `${activeCount} results` : ""}` : ""}
                {activeTab === "failed" ? `Invoices where dunning retries were exhausted. ${hasActiveFilters ? `${activeCount} results` : ""}` : ""}
              </p>
            </div>
            <Badge variant="neutral">{activeCount} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* TAB: Due for Renewal */}
          {activeTab === "due" && (
            <>
              {(!dueMemberships || dueMemberships.length === 0) ? (
                <EmptyState simple text={searchQuery ? "No members match your search." : "No memberships are due for renewal in the next 30 days."} />
              ) : (
                dueMemberships.map((m) => {
                  const member = memberMap.get(m.member_id);
                  const days = calcDays(m.end_date);
                  return (
                    <div key={m.id} className="rounded-md border border-border bg-surface-muted p-4">
                      <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{member?.full_name ?? "Unknown"}</p>
                            <Badge variant={days <= 3 ? "error" : days <= 7 ? "warning" : "neutral"}>{days}d left</Badge>
                            <Badge variant={m.auto_renew ? "success" : "neutral"}>{m.auto_renew ? "Auto" : "Manual"}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{member?.email ?? ""} · {planMap.get(m.membership_plan_id) ?? "Unknown Plan"}</p>
                          <p className="text-xs text-muted-foreground">Expires: {m.end_date ? new Date(m.end_date).toLocaleDateString("en-IN") : "—"} · Amount: {formatCurrency(m.total_amount)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ButtonLink href={`/admin/members?q=${encodeURIComponent(member?.full_name ?? "")}`} size="sm" variant="ghost">
                            <UserRound className="size-3.5" />
                          </ButtonLink>
                          <ButtonLink href={`/admin/members/${m.member_id}`} size="sm" variant="secondary">Renew</ButtonLink>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB: Overdue / Expired */}
          {activeTab === "overdue" && (
            <>
              {(!overdueMemberships || overdueMemberships.length === 0) ? (
                <EmptyState simple text={searchQuery ? "No members match your search." : "No overdue memberships found. All memberships are up to date."} />
              ) : (
                overdueMemberships.map((m) => {
                  const member = memberMap.get(m.member_id);
                  const days = calcDays(m.end_date);
                  return (
                    <div key={m.id} className="rounded-md border border-border bg-surface-muted p-4">
                      <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{member?.full_name ?? "Unknown"}</p>
                            <Badge variant="error">Overdue</Badge>
                            <Badge variant="neutral">{Math.abs(days)}d overdue</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{member?.email ?? ""} · {planMap.get(m.membership_plan_id) ?? "Unknown Plan"}</p>
                          <p className="text-xs text-muted-foreground">Expired: {m.end_date ? new Date(m.end_date).toLocaleDateString("en-IN") : "—"} · Amount: {formatCurrency(m.total_amount)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ButtonLink href={`/admin/members?q=${encodeURIComponent(member?.full_name ?? "")}`} size="sm" variant="ghost">
                            <UserRound className="size-3.5" />
                          </ButtonLink>
                          <ButtonLink href={`/admin/members/${m.member_id}`} size="sm" variant="secondary">Renew</ButtonLink>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB: Failed Payments */}
          {activeTab === "failed" && (
            <>
              {(!failedInvoicesData || failedInvoicesData.length === 0) ? (
                <EmptyState simple text={searchQuery ? "No failed invoices match your search." : "No failed payment retries. All dunning cases are active."} />
              ) : (
                failedInvoicesData.map((inv) => {
                  const member = memberMap.get(inv.member_id);
                  const daysSince = inv.dunning_last_attempt_at
                    ? Math.ceil((today.getTime() - new Date(inv.dunning_last_attempt_at).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  return (
                    <div key={inv.id} className="rounded-md border border-border bg-surface-muted p-4">
                      <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{member?.full_name ?? "Unknown"}</p>
                            <Badge variant="error">Failed</Badge>
                            <Badge variant="neutral">{inv.dunning_attempts} attempts</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{member?.email ?? ""} · Invoice: {inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">
                            Amount: {formatCurrency(inv.total_amount ?? inv.amount_due)} · {daysSince}d since last attempt
                          </p>
                          {inv.dunning_last_failure_reason ? (
                            <p className="mt-1 text-xs text-red-600">Reason: {inv.dunning_last_failure_reason.slice(0, 120)}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ButtonLink href={`/admin/payment-failures?q=${encodeURIComponent(member?.full_name ?? "")}`} size="sm" variant="ghost">
                            <RefreshCcw className="size-3.5" />
                          </ButtonLink>
                          <ButtonLink href={`/admin/members/${inv.member_id}`} size="sm" variant="secondary">Renew</ButtonLink>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </CardContent>
      </Card>

      {activeCount > PAGE_SIZE && (
        <nav className="flex items-center justify-between text-sm">
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(activeCount / PAGE_SIZE) }).map((_, i) => (
              <a key={i} href={`/admin/renewals?tab=${activeTab}&page=${i + 1}${searchQuery ? `&q=${searchQuery}` : ""}`}
                className={`flex size-10 items-center justify-center rounded-md ${i + 1 === currentPage ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {i + 1}
              </a>
            ))}
          </div>
          <span className="text-muted-foreground">{activeCount} total</span>
        </nav>
      )}
    </div>
  );
}
