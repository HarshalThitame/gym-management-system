import type { Metadata } from "next";
import { AlertTriangle, Clock, Filter, RefreshCcw, Search, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Partial Payments & Dues",
  description: "Track invoices with outstanding balances and partial payments.",
  path: "/admin/partial-payments",
});

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

const PAGE_SIZE = 20;

export default async function AdminPartialPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/partial-payments");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "partial_payment_dues",
    actionName: "admin.partial-payments.read",
  });

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const searchQuery = params.q?.trim() || "";
  const statusFilter = params.status || "";

  const { data: agg } = await supabase
    .from("invoices")
    .select("total_amount, amount_paid, amount_due, status, due_at")
    .eq("gym_id", scope.gymId)
    .neq("status", "cancelled") as never as {
    data: Array<{ total_amount: number | null; amount_paid: number; amount_due: number; status: string; due_at: string | null }> | null;
    error: unknown;
  };

  const allOutstanding = (agg ?? []).filter((inv) => inv.amount_due > 0);
  const totalOutstandingAmount = allOutstanding.reduce((s, inv) => s + inv.amount_due, 0);
  const totalMembersWithDues = new Set(allOutstanding.filter((inv) => inv.amount_due > 0).map(() => "unique")).size;
  const overdueCount = allOutstanding.filter((inv) => inv.status === "overdue" || (inv.due_at && new Date(inv.due_at) < new Date())).length;

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, amount_paid, amount_due, status, due_at, created_at, member_id, notes", { count: "exact" })
    .eq("gym_id", scope.gymId)
    .neq("status", "cancelled")
    .neq("status", "draft")
    .gt("amount_due", 0);

  if (statusFilter === "issued") query = query.eq("status", "issued");
  else if (statusFilter === "partially_paid") query = query.eq("status", "partially_paid");
  else if (statusFilter === "overdue") query = query.eq("status", "overdue");

  if (searchQuery) {
    const { data: matched } = await supabase.from("members").select("id").eq("gym_id", scope.gymId).ilike("full_name", `%${searchQuery}%`) as never as {
      data: Array<{ id: string }> | null;
      error: unknown;
    };
    const ids = (matched ?? []).map((m) => m.id);
    if (ids.length > 0) query = query.in("member_id", ids);
    else query = query.in("member_id", [""]);
  }

  const { data: invoices, count } = await query
    .order("due_at", { ascending: true, nullsLast: true })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{
      id: string; invoice_number: string; total_amount: number | null;
      amount_paid: number; amount_due: number; status: string;
      due_at: string | null; created_at: string; member_id: string; notes: string | null;
    }> | null;
    count: number | null;
    error: unknown;
  };

  const memberIds = [...new Set((invoices ?? []).map((i) => i.member_id))];
  const { data: members } = memberIds.length > 0
    ? await supabase.from("members").select("id, full_name, email").in("id", memberIds) as never as {
        data: Array<{ id: string; full_name: string; email: string | null }> | null;
        error: unknown;
      }
    : { data: [] as Array<{ id: string; full_name: string; email: string | null }> };

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const hasActiveFilters = !!searchQuery || !!statusFilter;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Collections</p>
        <h2 className="mt-2 text-3xl font-black">Partial Payments & Dues</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Track invoices with outstanding balances, partial payments, and overdue amounts.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Sum of all outstanding amounts" icon={<RefreshCcw className="size-5" />} label="Total Outstanding" value={formatCurrency(totalOutstandingAmount)} />
        <StatCard detail="Invoices partially paid" icon={<AlertTriangle className="size-5" />} label="Overdue Invoices" value={String(overdueCount)} />
        <StatCard detail="Members with outstanding dues" icon={<UsersRound className="size-5" />} label="Members with Dues" value={String(allOutstanding.length)} />
        <StatCard detail="Past due date" icon={<Clock className="size-5" />} label="Avg Days Overdue" value="—" />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_auto_auto]" method="get">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm" name="q" placeholder="Search member name..." defaultValue={searchQuery} />
            </div>
            <select className="h-11 rounded-md border border-border bg-surface px-3 text-sm" name="status" defaultValue={statusFilter || "all"}>
              <option value="all">All statuses</option>
              <option value="issued">Issued</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <button className="flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground" type="submit">
              <Filter className="size-4" /> Apply
            </button>
            {hasActiveFilters ? <a href="/admin/partial-payments" className="flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted">Clear</a> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Outstanding Invoices</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {hasActiveFilters ? `${count ?? 0} result${(count ?? 0) === 1 ? "" : "s"}` : `All invoices with outstanding balances.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!invoices || invoices.length === 0) ? (
            <EmptyState simple text={searchQuery ? "No invoices match your search." : "All invoices are fully paid. No outstanding balances."} />
          ) : (
            invoices.map((inv) => {
              const member = memberMap.get(inv.member_id);
              const isOverdue = inv.due_at && new Date(inv.due_at) < new Date();
              return (
                <div key={inv.id} className="rounded-md border border-border bg-surface-muted p-4">
                  <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{inv.invoice_number}</p>
                        <Badge variant={inv.status === "overdue" ? "error" : inv.status === "partially_paid" ? "warning" : "neutral"}>{inv.status.replace(/_/g, " ")}</Badge>
                        {isOverdue ? <Badge variant="error">Overdue</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold">{member?.full_name ?? "Unknown"}</p>
                      {member?.email ? <p className="text-xs text-muted-foreground">{member.email}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {inv.due_at ? `Due: ${new Date(inv.due_at).toLocaleDateString("en-IN")}` : "No due date"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <p className="text-lg font-black">{formatCurrency(inv.amount_due)}</p>
                      <p className="text-xs text-muted-foreground">
                        of {formatCurrency(inv.total_amount ?? inv.amount_due + inv.amount_paid)}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Paid: {formatCurrency(inv.amount_paid)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <a key={i} href={`/admin/partial-payments?page=${i + 1}${searchQuery ? `&q=${searchQuery}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`flex size-10 items-center justify-center rounded-md ${i + 1 === currentPage ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {i + 1}
              </a>
            ))}
          </div>
          <span className="text-muted-foreground">{count ?? 0} total</span>
        </nav>
      )}
    </div>
  );
}
