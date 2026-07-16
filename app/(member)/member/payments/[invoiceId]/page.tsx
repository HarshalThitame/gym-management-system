import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarDays, CreditCard, Download, FileText, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyableMetaRow } from "@/features/member/components/copyable-meta-row";
import { PaymentCheckoutButton } from "@/features/billing/components/payment-checkout-button";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { AnimatedCardSection, PageHeader } from "@/features/member/components/page-wrappers";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type RefundRow = Database["public"]["Tables"]["refunds"]["Row"];

export const metadata: Metadata = createMetadata({
  title: "Invoice Details",
  description: "Detailed invoice and receipt view for a member payment.",
  path: "/member/payments",
});

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function MemberInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const context = await requireMemberPortalAccess("/member/payments");
  const profile = context.userId ? await getMemberProfile(context.userId) : null;
  const member = profile?.member ?? null;
  const { invoiceId } = await params;

  if (!member) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Invoice Details</h2></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No member profile is connected to this login.</p></CardContent>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: invoice }, { data: items }, { data: payments }, { data: refunds }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).eq("member_id", member.id).maybeSingle() as never as {
      data: InvoiceRow | null;
      error: unknown;
    },
    supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true }) as never as {
      data: Array<Record<string, unknown>> | null;
      error: unknown;
    },
    supabase.from("payments").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }).limit(10) as never as {
      data: PaymentRow[] | null;
      error: unknown;
    },
    supabase.from("refunds").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }).limit(10) as never as {
      data: RefundRow[] | null;
      error: unknown;
    },
  ]);

  if (!invoice) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ArrowLeft className="size-5 text-muted-foreground" />
            <h2 className="text-2xl font-black">Invoice not found</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This invoice is not available for your account.</p>
        </CardContent>
      </Card>
    );
  }

  const latestPendingPayment = payments?.find((payment) => ["pending", "processing", "failed"].includes(payment.status)) ?? null;
  const latestPayment = payments?.[0] ?? null;
  const total = invoice.total_amount ?? invoice.amount_due ?? 0;
  const paid = invoice.amount_paid ?? 0;
  const due = invoice.amount_due ?? Math.max(0, total - paid);
  const isPaid = invoice.status === "paid" || paid >= total;
  const activity = buildTimeline(items ?? [], payments ?? [], refunds ?? [], invoice);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title={`Invoice ${invoice.invoice_number}`}
        description="Detailed billing record with receipt status, payment events, and downloadable invoice PDF."
      />

      <AnimatedCardSection>
        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Badge variant="member-info" className="gap-1.5 border-white/20 text-white">
              <ReceiptText className="size-3.5" />
              Receipt #{invoice.invoice_number}
            </Badge>
            <Badge variant={isPaid ? "success" : "warning"} className="gap-1.5">
              {isPaid ? "Settled" : "Awaiting payment"}
            </Badge>
            <Badge variant="neutral" className="gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatDate(invoice.issued_at ?? invoice.created_at)}
            </Badge>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Invoice detail</p>
                <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{formatCurrency(total, invoice.currency)}</h2>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72">
                  {isPaid ? "This invoice has been settled and can be downloaded as a receipt." : "This invoice is pending payment. Complete it online to close the balance."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/member/payments" variant="secondary" className="gap-2">
                <ArrowLeft className="size-4" />
                Back to payments
              </ButtonLink>
              <ButtonLink href={`/api/member/invoices/${invoice.id}/pdf`} variant="primary" className="gap-2">
                <Download className="size-4" />
                Download PDF
              </ButtonLink>
            </div>
          </div>
        </section>
      </AnimatedCardSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <AnimatedCardSection delay={0.05}>
            <Card variant="glass">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-black">Invoice Summary</h3>
                  <StatusBadge status={invoice.status} />
                  {isPaid ? <Badge variant="success" className="gap-1.5"><BadgeCheck className="size-3.5" />Receipt</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoBox label="Invoice Number" value={invoice.invoice_number} />
                  <InfoBox label="Status" value={invoice.status.replace(/_/g, " ")} />
                  <InfoBox label="Issued" value={formatDate(invoice.issued_at ?? invoice.created_at)} />
                  <InfoBox label="Due" value={formatDate(invoice.due_at)} />
                  <InfoBox label="Paid" value={formatCurrency(paid, invoice.currency)} />
                  <InfoBox label="Due Amount" value={formatCurrency(due, invoice.currency)} />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <MetricBox label="Subtotal" value={formatCurrency(invoice.subtotal_amount ?? total, invoice.currency)} icon={<FileText className="size-4" />} />
                  <MetricBox label="Discount" value={formatCurrency(invoice.discount_amount ?? 0, invoice.currency)} icon={<TagIcon />} />
                  <MetricBox label="Tax" value={formatCurrency(invoice.tax_amount ?? 0, invoice.currency)} icon={<ReceiptText className="size-4" />} />
                </div>
              </CardContent>
            </Card>
          </AnimatedCardSection>

          <AnimatedCardSection delay={0.1}>
            <Card variant="glass">
              <CardHeader>
                <h3 className="text-2xl font-black">Line Items</h3>
                <p className="text-sm text-muted-foreground">What this invoice covers.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {items && items.length > 0 ? (
                  items.map((item) => <LineItemRow key={String(item.id ?? item.description ?? Math.random())} item={item} currency={invoice.currency} />)
                ) : (
                  <EmptyLine text="No line items were recorded for this invoice." />
                )}
              </CardContent>
            </Card>
          </AnimatedCardSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <AnimatedCardSection delay={0.15}>
              <Card variant="glass">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CreditCard className="size-5 text-slate" />
                    <div>
                      <h3 className="text-2xl font-black">Payments</h3>
                      <p className="text-sm text-muted-foreground">Captured and pending payment events for this invoice.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payments && payments.length > 0 ? payments.map((payment) => <PaymentRow key={payment.id} payment={payment} />) : <EmptyLine text="No payment records found." />}
                </CardContent>
              </Card>
            </AnimatedCardSection>

            <AnimatedCardSection delay={0.2}>
              <Card variant="glass">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <ReceiptText className="size-5 text-slate" />
                    <div>
                      <h3 className="text-2xl font-black">Refunds</h3>
                      <p className="text-sm text-muted-foreground">Any partial or processed refunds tied to this invoice.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {refunds && refunds.length > 0 ? refunds.map((refund) => <RefundRow key={refund.id} refund={refund} />) : <EmptyLine text="No refunds have been recorded." />}
                </CardContent>
              </Card>
            </AnimatedCardSection>
          </div>

          {latestPendingPayment ? (
            <AnimatedCardSection delay={0.25}>
              <Card variant="glow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="size-5 text-slate" />
                    <div>
                      <h3 className="text-2xl font-black">Complete Payment</h3>
                      <p className="text-sm text-muted-foreground">Continue the pending online payment using your gym gateway.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PaymentCheckoutButton
                    amount={latestPendingPayment.amount}
                    memberEmail={profile?.member.email}
                    memberName={profile?.member.full_name}
                    memberPhone={profile?.member.phone}
                    paymentId={latestPendingPayment.id}
                    label="Open Secure Checkout"
                  />
                </CardContent>
              </Card>
            </AnimatedCardSection>
          ) : null}

          <AnimatedCardSection delay={0.3}>
            <Card variant="glass">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black">Payment Timeline</h3>
                    <p className="text-sm text-muted-foreground">Chronological billing activity for this receipt.</p>
                  </div>
                  <Badge variant="member-info" className="gap-1.5">
                    <Sparkles className="size-3.5" />
                    Audit trail
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {activity.length > 0 ? activity.map((item) => <ActivityRow key={item.key} item={item} invoiceId={invoice.id} />) : <EmptyLine text="No activity yet." />}
              </CardContent>
            </Card>
          </AnimatedCardSection>
        </div>

        <aside className="space-y-6 self-start xl:sticky xl:top-6">
          <AnimatedCardSection delay={0.08}>
            <Card variant="glass-dark" className="border-white/10 bg-slate-950/80 text-white">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CalendarDays className="size-5 text-cyan-300" />
                  <div>
                    <h3 className="text-2xl font-black">Receipt Snapshot</h3>
                    <p className="text-sm text-white/60">At-a-glance receipt information for support or records.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SidebarStat label="Invoice" value={invoice.invoice_number} />
                <SidebarStat label="Currency" value={invoice.currency} />
                <SidebarStat label="Amount" value={formatCurrency(total, invoice.currency)} />
                <SidebarStat label="Balance Due" value={formatCurrency(due, invoice.currency)} />
                <SidebarStat label="Payments" value={String(payments?.length ?? 0)} />
                <SidebarStat label="Refunds" value={String(refunds?.length ?? 0)} />
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">Status</p>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    {isPaid ? "Receipt generated. Download the PDF for records or share it with support if needed." : "Invoice is awaiting payment. Use the secure checkout action when ready."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </AnimatedCardSection>

          <AnimatedCardSection delay={0.1}>
            <Card variant="glass">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black">Receipt Metadata</h3>
                    <p className="text-sm text-muted-foreground">Identifiers and support references for this receipt.</p>
                  </div>
                  <Badge variant="member-info" className="gap-1.5">
                    <Sparkles className="size-3.5" />
                    Audit ready
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyableMetaRow label="Invoice ID" value={invoice.id} />
                <CopyableMetaRow label="Latest Payment" value={latestPayment?.payment_number ?? "No payment yet"} />
                <CopyableMetaRow label="Provider" value={latestPayment ? latestPayment.provider.replace(/_/g, " ") : "Not assigned"} />
                <CopyableMetaRow label="Method" value={latestPayment ? latestPayment.method.replace(/_/g, " ") : "Not assigned"} />
                <CopyableMetaRow label="Support Ref" value={`INV-${invoice.invoice_number}-${invoice.id.slice(0, 8)}`} />
              </CardContent>
            </Card>
          </AnimatedCardSection>

        </aside>
      </div>
    </div>
  );
}

async function getMemberProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, member_code, email, phone")
    .eq("user_id", userId)
    .maybeSingle() as never as {
    data: { id: string; full_name: string; member_code: string; email: string | null; phone: string } | null;
    error: unknown;
  };

  return { member };
}

type ActivityItem = {
  key: string;
  title: string;
  detail: string;
  when: string;
  kind: "payment" | "invoice" | "refund";
};

function buildActivity(items: Array<Record<string, unknown>>, payments: PaymentRow[], refunds: RefundRow[]): ActivityItem[] {
  const invoices = payments.map((payment) => ({
    key: `payment-${payment.id}`,
    title: payment.status === "paid" ? "Payment completed" : `Payment ${payment.status}`,
    detail: `${payment.payment_number} · ${formatCurrency(payment.amount, payment.currency)}`,
    when: payment.created_at,
    kind: "payment" as const,
  }));

  const invoiceItems = items.map((item) => ({
    key: `item-${String(item.id ?? item.description ?? Math.random())}`,
    title: String(item.description ?? "Invoice item"),
    detail: `${String(item.quantity ?? 1)} × ${formatCurrency(Number(item.total_amount ?? 0), String(item.currency ?? "INR"))}`,
    when: String(item.created_at ?? ""),
    kind: "invoice" as const,
  }));

  const refundItems = refunds.map((refund) => ({
    key: `refund-${refund.id}`,
    title: `Refund ${refund.status}`,
    detail: `${refund.reason} · ${formatCurrency(refund.amount, refund.currency)}`,
    when: refund.created_at,
    kind: "refund" as const,
  }));

  return [...invoices, ...invoiceItems, ...refundItems]
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, 6);
}

function buildTimeline(items: Array<Record<string, unknown>>, payments: PaymentRow[], refunds: RefundRow[], invoice: InvoiceRow): ActivityItem[] {
  const timeline = [
    ...buildActivity(items, payments, refunds),
    {
      key: `invoice-issued-${invoice.id}`,
      title: "Invoice issued",
      detail: `${invoice.invoice_number} · ${formatCurrency(invoice.total_amount ?? invoice.amount_due ?? 0, invoice.currency)}`,
      when: invoice.issued_at ?? invoice.created_at,
      kind: "invoice" as const,
    },
    ...(invoice.due_at
      ? [
          {
            key: `invoice-due-${invoice.id}`,
            title: "Payment due",
            detail: `Due by ${formatDate(invoice.due_at)}`,
            when: invoice.due_at,
            kind: "invoice" as const,
          },
        ]
      : []),
  ];

  return timeline
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, 8);
}

function StatusBadge({ status }: { status: string }) {
  if (["paid", "processed", "approved"].includes(status)) return <Badge variant="member-success">{status.replace(/_/g, " ")}</Badge>;
  if (["failed", "cancelled", "refunded"].includes(status)) return <Badge variant="member-error">{status.replace(/_/g, " ")}</Badge>;
  if (["pending", "processing", "partially_paid", "partially_refunded", "requested"].includes(status)) return <Badge variant="member-warning">{status.replace(/_/g, " ")}</Badge>;
  return <Badge variant="member-info">{status.replace(/_/g, " ")}</Badge>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm font-bold">{value}</p>
    </div>
  );
}

function MetricBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  );
}

function LineItemRow({ item, currency }: { item: Record<string, unknown>; currency: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold">{String(item.description ?? "Line item")}</p>
          <p className="mt-1 text-xs text-muted-foreground">Qty {String(item.quantity ?? 1)}</p>
        </div>
        <p className="text-sm font-black">{formatCurrency(Number(item.total_amount ?? 0), currency)}</p>
      </div>
    </div>
  );
}

function PaymentRow({ payment }: { payment: PaymentRow }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">{payment.payment_number}</p>
          <p className="mt-1 text-xs text-muted-foreground">{payment.provider.toUpperCase()} · {new Date(payment.created_at).toLocaleString("en-IN")}</p>
        </div>
        <StatusBadge status={payment.status} />
      </div>
      <p className="mt-3 text-sm font-black">{formatCurrency(payment.amount, payment.currency)}</p>
    </div>
  );
}

function RefundRow({ refund }: { refund: RefundRow }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">{refund.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">{new Date(refund.created_at).toLocaleDateString("en-IN")}</p>
        </div>
        <StatusBadge status={refund.status} />
      </div>
      <p className="mt-3 text-sm font-black">{formatCurrency(refund.amount, refund.currency)}</p>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">{label}</p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function ActivityRow({ item, invoiceId }: { item: ActivityItem; invoiceId: string }) {
  return (
    <Link href={`/member/payments/${invoiceId}`} className="block rounded-2xl border border-border bg-surface-muted p-4 transition hover:border-primary/40 hover:bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
        </div>
        <Badge variant={item.kind === "payment" ? "success" : item.kind === "refund" ? "warning" : "neutral"}>{item.kind}</Badge>
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{formatDate(item.when)}</p>
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-2xl border border-border bg-surface-muted p-4 text-sm text-muted-foreground">{text}</div>;
}

function TagIcon() {
  return <span className="inline-flex size-4 items-center justify-center rounded bg-amber-400/20 text-[10px] font-black text-amber-300">%</span>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
