import type { Metadata } from "next";
import { CreditCard, ArrowUpRight, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { GeneratePaymentLinkButton } from "@/features/billing/components/generate-payment-link-button";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Online Payment Links",
  description: "Generate and share Razorpay payment links for unpaid invoices.",
  path: "/admin/payment-links",
});

const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string; q?: string }>;

type InvoiceWithMember = {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  due_date: string | null;
  notes: string | null;
  currency: string;
  member_name: string;
  existing_link_id: string | null;
  existing_link_url: string | null;
};

export default async function AdminPaymentLinksPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/payment-links");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "online_payment_links",
    actionName: "admin.payment-links.read",
  });

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1"));
  const query = (params.q ?? "").trim();
  const offset = (currentPage - 1) * PAGE_SIZE;

  let baseQuery = supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, amount_due, amount_paid, status, due_date, notes, currency, member_id, razorpay_order_id, payment_link")
    .eq("gym_id", scope.gymId)
    .in("status", ["pending", "overdue", "partially_paid"]);

  let countQuery = supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("gym_id", scope.gymId)
    .in("status", ["pending", "overdue", "partially_paid"]);

  if (query) {
    const pattern = `%${query}%`;
    countQuery = countQuery.or(`invoice_number.ilike.${pattern},notes.ilike.${pattern}`);
    baseQuery = baseQuery.or(`invoice_number.ilike.${pattern},notes.ilike.${pattern}`);
  }

  const { count } = await countQuery as never as { count: number | null; error: { message: string } | null };
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const { data: invoices } = await baseQuery
    .order("due_date", { ascending: true, nullsLast: true })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{
      id: string;
      invoice_number: string;
      total_amount: number | null;
      amount_due: number;
      amount_paid: number;
      status: string;
      due_date: string | null;
      notes: string | null;
      currency: string;
      member_id: string;
      razorpay_order_id: string | null;
      payment_link: string | null;
    }> | null;
    error: { message: string } | null;
  };

  const memberIds = [...new Set((invoices ?? []).map((i) => i.member_id))];

  const { data: members } = memberIds.length > 0
    ? await supabase.from("members").select("id, full_name").in("id", memberIds) as never as {
        data: Array<{ id: string; full_name: string }> | null;
        error: { message: string } | null;
      }
    : { data: [] as Array<{ id: string; full_name: string }> };

  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const linkUrlMap = new Map<string, string>();
  for (const inv of invoices ?? []) {
    if (inv.payment_link) linkUrlMap.set(inv.id, inv.payment_link);
  }

  const rows: InvoiceWithMember[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    total_amount: inv.total_amount ?? inv.amount_due,
    status: inv.status,
    due_date: inv.due_date,
    notes: inv.notes,
    currency: inv.currency,
    member_name: memberMap.get(inv.member_id) ?? "Unknown",
    existing_link_id: inv.razorpay_order_id,
    existing_link_url: inv.razorpay_order_id ? (linkUrlMap.get(inv.razorpay_order_id) ?? null) : null,
  }));

  const totalOutstanding = rows.reduce((sum, r) => sum + r.total_amount, 0);
  const overdueCount = rows.filter((r) => r.status === "overdue").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Collections</p>
        <h2 className="mt-2 text-3xl font-black">Online Payment Links</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Generate shareable Razorpay payment links for unpaid invoices. Send the link to members via email.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Unpaid invoices available" icon={<CreditCard className="size-5" />} label="Total Outstanding" value={formatCurrency(totalOutstanding)} />
        <StatCard detail="Awaiting payment" icon={<ArrowUpRight className="size-5" />} label="Pending" value={String(pendingCount)} />
        <StatCard detail="Past due date" icon={<ArrowUpRight className="size-5" />} label="Overdue" value={String(overdueCount)} />
      </section>

      <div className="flex items-center gap-4">
        <form className="flex flex-1 items-center gap-2" method="GET">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              defaultValue={query}
              name="q"
              type="text"
              placeholder="Search by invoice number or notes..."
              className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Search invoices"
            />
          </div>
          <button type="submit" className="h-11 rounded-lg border border-border bg-surface px-4 text-sm font-bold hover:bg-accent/10 transition-colors">Search</button>
          {query && (
            <a href="/admin/payment-links" className="h-11 rounded-lg border border-border bg-surface px-4 text-sm font-bold hover:bg-accent/10 transition-colors inline-flex items-center">Clear</a>
          )}
        </form>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Unpaid Invoices</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Invoices with pending, partial, or overdue status. Generate a payment link to collect online.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <EmptyState
              simple={!query}
              text={query ? `No results for "${query}". Try a different search.` : "No unpaid invoices found for this gym."}
            >
              {!query ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Invoices are created when members purchase or renew memberships.{" "}
                  <ButtonLink href="/admin/members" variant="primary" size="sm" className="mt-2">
                    View Members
                  </ButtonLink>
                </p>
              ) : null}
            </EmptyState>
          ) : null}
          {rows.map((invoice) => (
              <div key={invoice.id} className="space-y-2 rounded-md border border-border bg-surface-muted p-4">
                <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{invoice.invoice_number}</p>
                      <InvoiceStatusBadge status={invoice.status} />
                      {invoice.existing_link_id ? <Badge variant="neutral">link sent</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold">{invoice.member_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.due_date ? `Due ${new Date(invoice.due_date).toLocaleDateString("en-IN")}` : "No due date"}
                      {invoice.notes ? ` · ${invoice.notes.slice(0, 60)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-black">{formatCurrency(invoice.total_amount, invoice.currency)}</p>
                    <GeneratePaymentLinkButton
                      invoiceId={invoice.id}
                      invoiceNumber={invoice.invoice_number}
                      existingUrl={invoice.existing_link_url}
                    />
                  </div>
                </div>
              </div>
          ))}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          baseHref="/admin/payment-links"
          totalItems={count ?? 0}
        />
      )}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge variant="success">paid</Badge>;
  if (status === "overdue") return <Badge variant="error">overdue</Badge>;
  if (status === "partially_paid") return <Badge variant="warning">partial</Badge>;
  if (status === "pending") return <Badge variant="warning">pending</Badge>;
  return <Badge variant="neutral">{status.replace(/_/g, " ")}</Badge>;
}
