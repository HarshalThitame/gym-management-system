import type { Metadata } from "next";
import { AlertTriangle, Ban, ChevronLeft, ChevronRight, Clock, Filter, RefreshCcw, Search, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { DunningActions } from "@/features/billing/components/dunning-actions";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Payment Failures & Dunning",
  description: "Monitor and manage failed payments, retry schedules, grace periods, and dunning cases.",
  path: "/admin/payment-failures",
});

const PAGE_SIZE = 20;
const DUNNING_STATI = ["payment_failed", "retry_scheduled", "overdue", "grace_period", "suspended", "resolved", "waived"] as const;

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

type DunningRow = {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  dunning_status: string | null;
  dunning_attempts: number;
  dunning_last_failure_reason: string | null;
  dunning_next_retry_at: string | null;
  dunning_grace_period_ends_at: string | null;
  member_name: string;
  member_email: string | null;
  member_phone: string | null;
};

function buildQueryString(q: string, status: string, page: number): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (status) p.set("status", status);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function AdminPaymentFailuresPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/payment-failures");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "payment_failure_handling",
    actionName: "admin.payment-failures.read",
  });

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const searchQuery = params.q?.trim() || "";
  const statusFilter = params.status || "";

  // ---- Aggregate stats (unfiltered, across ALL dunning) ----
  const baseDunningQuery = (q: ReturnType<typeof supabase.from>) =>
    q
      .from("invoices")
      .eq("gym_id", scope.gymId)
      .not("dunning_status", "is", null)
      .not("dunning_status", "eq", "none");

  const { data: agg } = await baseDunningQuery(supabase)
    .select("total_amount, amount_due, dunning_status") as never as {
    data: Array<{ total_amount: number | null; amount_due: number; dunning_status: string | null }> | null;
    error: unknown;
  };

  const totalDunningCount = agg?.length ?? 0;
  const totalDunningAmount = (agg ?? []).reduce((s, r) => s + (r.total_amount ?? r.amount_due), 0);
  const totalFailedCount = (agg ?? []).filter((r) => r.dunning_status === "payment_failed").length;
  const totalGraceCount = (agg ?? []).filter((r) => r.dunning_status === "grace_period").length;
  const totalRetryCount = (agg ?? []).filter((r) => r.dunning_status === "retry_scheduled").length;
  const totalOverdueCount = (agg ?? []).filter((r) => r.dunning_status === "overdue").length;

  // ---- Filtered/paginated table ----
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

  function applyFilters(builder: ReturnType<typeof supabase.from>) {
    let q = builder
      .eq("gym_id", scope.gymId)
      .not("dunning_status", "is", null)
      .not("dunning_status", "eq", "none");

    if (statusFilter && DUNNING_STATI.includes(statusFilter as typeof DUNNING_STATI[number])) {
      q = q.eq("dunning_status", statusFilter);
    }

    if (searchQuery) {
      const invClause = `invoice_number.ilike.%${searchQuery}%`;
      if (matchedMemberIds && matchedMemberIds.length > 0) {
        q = q.or(`${invClause},member_id.in.(${matchedMemberIds.join(",")})`) as typeof q;
      } else {
        q = q.or(invClause) as typeof q;
      }
    }

    return q;
  }

  const countResult = await applyFilters(supabase.from("invoices"))
    .select("*", { count: "exact", head: true }) as never as {
    count: number | null;
    error: unknown;
  };
  const filteredCount = countResult.count ?? 0;
  const totalPages = Math.ceil(filteredCount / PAGE_SIZE);

  const { data: invoices } = await applyFilters(supabase.from("invoices"))
    .select("id, invoice_number, total_amount, amount_due, status, dunning_status, dunning_attempts, dunning_last_failure_reason, dunning_next_retry_at, dunning_grace_period_ends_at, member_id")
    .order("dunning_next_retry_at", { ascending: true, nullsLast: true })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{
      id: string;
      invoice_number: string;
      total_amount: number | null;
      amount_due: number;
      status: string;
      dunning_status: string | null;
      dunning_attempts: number;
      dunning_last_failure_reason: string | null;
      dunning_next_retry_at: string | null;
      dunning_grace_period_ends_at: string | null;
      member_id: string;
    }> | null;
    error: unknown;
  };

  const memberIds = [...new Set((invoices ?? []).map((i) => i.member_id))];

  const { data: members } = memberIds.length > 0
    ? await supabase.from("members").select("id, full_name, email, phone").in("id", memberIds) as never as {
        data: Array<{ id: string; full_name: string; email: string | null; phone: string | null }> | null;
        error: unknown;
      }
    : { data: [] as Array<{ id: string; full_name: string; email: string | null; phone: string | null }> };

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

  const rows: DunningRow[] = (invoices ?? []).map((inv) => {
    const member = memberMap.get(inv.member_id);
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      total_amount: inv.total_amount ?? inv.amount_due,
      status: inv.status,
      dunning_status: inv.dunning_status,
      dunning_attempts: inv.dunning_attempts,
      dunning_last_failure_reason: inv.dunning_last_failure_reason,
      dunning_next_retry_at: inv.dunning_next_retry_at,
      dunning_grace_period_ends_at: inv.dunning_grace_period_ends_at,
      member_name: member?.full_name ?? "Unknown",
      member_email: member?.email ?? null,
      member_phone: member?.phone ?? null,
    };
  });

  const hasActiveFilters = !!searchQuery || !!statusFilter;
  const noResults = rows.length === 0;

  function pageHref(p: number) {
    return `/admin/payment-failures${buildQueryString(searchQuery, statusFilter, p)}`;
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
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Collections</p>
        <h2 className="mt-2 text-3xl font-black">Payment Failures & Dunning</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Monitor and manage invoices with failed payments. Retry payments, extend grace periods, waive dunning, or mark as resolved.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard detail="Total invoices in dunning process" icon={<AlertTriangle className="size-5" />} label="In Dunning" value={String(totalDunningCount)} />
        <StatCard detail="Awaiting manual action" icon={<Ban className="size-5" />} label="Failed" value={String(totalFailedCount)} />
        <StatCard detail="Scheduled for auto-retry" icon={<RefreshCcw className="size-5" />} label="Retry Scheduled" value={String(totalRetryCount)} />
        <StatCard detail="In grace period" icon={<Clock className="size-5" />} label="Grace Period" value={String(totalGraceCount)} />
        <StatCard detail="Past due date with dunning" icon={<AlertTriangle className="size-5" />} label="Overdue" value={String(totalOverdueCount)} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard detail="Sum across all dunning invoices" icon={<UsersRound className="size-5" />} label="Total Dunning Amount" value={formatCurrency(totalDunningAmount)} />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_auto_auto]" method="get">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm"
                name="q"
                placeholder="Search invoice number or member name..."
                defaultValue={searchQuery}
              />
            </div>
            <select className="h-11 rounded-md border border-border bg-surface px-3 text-sm" name="status" defaultValue={statusFilter || "all"}>
              <option value="all">All statuses</option>
              <option value="payment_failed">Payment failed</option>
              <option value="retry_scheduled">Retry scheduled</option>
              <option value="overdue">Overdue</option>
              <option value="grace_period">Grace period</option>
              <option value="suspended">Suspended</option>
              <option value="resolved">Resolved</option>
              <option value="waived">Waived</option>
            </select>
            <button className="flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground" type="submit">
              <Filter className="size-4" />
              Apply
            </button>
            {hasActiveFilters && (
              <a
                href="/admin/payment-failures"
                className="flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted"
              >
                Clear
              </a>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-black">Active Dunning Cases</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {hasActiveFilters
                  ? `${filteredCount} result${filteredCount === 1 ? "" : "s"} — clear filters to see all`
                  : "Invoices with non-resolved dunning status. Actions may create Razorpay orders or change invoice state."}
              </p>
            </div>
            {filteredCount > 0 && (
              <p className="text-sm font-semibold text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {noResults && !hasActiveFilters ? (
            <EmptyState simple text="No active dunning cases. All payments are up to date." />
          ) : null}

          {noResults && hasActiveFilters ? (
            <EmptyState
              simple
              text="No dunning cases match your search or filter criteria. Try adjusting your filters."
            />
          ) : null}

          {rows.map((row) => (
            <div key={row.id} className="space-y-3 rounded-md border border-border bg-surface-muted p-4">
              <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{row.invoice_number}</p>
                    <DunningStatusBadge status={row.dunning_status} />
                  </div>
                  <p className="mt-1 text-sm font-semibold">{row.member_name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {row.member_email ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">Email:</span> {row.member_email}
                      </span>
                    ) : null}
                    {row.member_phone ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">Phone:</span> {row.member_phone}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attempts: {row.dunning_attempts}
                    {row.dunning_next_retry_at ? ` · Next retry: ${new Date(row.dunning_next_retry_at).toLocaleDateString("en-IN")}` : ""}
                    {row.dunning_grace_period_ends_at ? ` · Grace until: ${new Date(row.dunning_grace_period_ends_at).toLocaleDateString("en-IN")}` : ""}
                  </p>
                  {row.dunning_last_failure_reason ? (
                    <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
                      <span className="mt-0.5 shrink-0">&#9888;</span>
                      <span>{row.dunning_last_failure_reason.slice(0, 200)}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-lg font-black">{formatCurrency(row.total_amount)}</p>
                  <DunningActions invoiceId={row.id} dunningStatus={row.dunning_status ?? "unknown"} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <ButtonLink
              href={pageHref(currentPage - 1)}
              size="sm"
              variant="ghost"
              aria-disabled={currentPage <= 1}
              className={currentPage <= 1 ? "pointer-events-none opacity-30" : ""}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </ButtonLink>

            {paginationPages.map((p, i) =>
              p === "ellipsis" ? (
                <span key={`e-${i}`} className="flex size-10 items-center justify-center text-sm text-muted-foreground">&hellip;</span>
              ) : (
                <ButtonLink
                  key={p}
                  href={pageHref(p)}
                  size="sm"
                  variant={p === currentPage ? "primary" : "ghost"}
                  aria-current={p === currentPage ? "page" : undefined}
                  aria-label={`Page ${p}`}
                >
                  {p}
                </ButtonLink>
              )
            )}

            <ButtonLink
              href={pageHref(currentPage + 1)}
              size="sm"
              variant="ghost"
              aria-disabled={currentPage >= totalPages}
              className={currentPage >= totalPages ? "pointer-events-none opacity-30" : ""}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </ButtonLink>
          </div>
          <span className="text-sm text-muted-foreground">{filteredCount} total</span>
        </nav>
      )}
    </div>
  );
}

function DunningStatusBadge({ status }: { status: string | null }) {
  const s = status ?? "none";
  if (s === "payment_failed") return <Badge variant="error">payment failed</Badge>;
  if (s === "overdue") return <Badge variant="error">overdue</Badge>;
  if (s === "retry_scheduled") return <Badge variant="info">retry scheduled</Badge>;
  if (s === "grace_period") return <Badge variant="warning">grace period</Badge>;
  if (s === "suspended") return <Badge variant="error">suspended</Badge>;
  if (s === "resolved") return <Badge variant="success">resolved</Badge>;
  if (s === "waived") return <Badge variant="neutral">waived</Badge>;
  return <Badge variant="neutral">{s.replace(/_/g, " ")}</Badge>;
}
