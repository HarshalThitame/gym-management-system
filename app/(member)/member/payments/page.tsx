import type { Metadata } from "next";
import { CreditCard, FileText, ReceiptText, RefreshCcw, ShieldCheck, Sparkles, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProviderBadge } from "@/features/billing/components/provider-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { PaymentCheckoutButton } from "@/features/billing/components/payment-checkout-button";
import { CouponInput } from "@/features/billing/components/coupon-input";
import { formatCurrency } from "@/features/billing/lib/money";
import { getMemberDashboard } from "@/features/memberships/services/membership-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { AnimatedCardSection, AnimatedListSection, AnimatedListItem } from "@/features/member/components/page-wrappers";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type RefundRow = Database["public"]["Tables"]["refunds"]["Row"];

export const metadata: Metadata = createMetadata({
  title: "Member Payments",
  description: "Protected member invoices, receipts, payments, and refunds.",
  path: "/member/payments"
});

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function MemberPaymentsPage() {
  const context = await requireMemberPortalAccess("/member/payments");
  const profile = context.userId ? await getMemberDashboard(context.userId) : null;

  if (!profile?.member) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Payments</h2></CardHeader>
        <CardContent><EmptyState text="No member record is connected to this login yet." /></CardContent>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: payments }, { data: invoices }, { data: refunds }] = await Promise.all([
    supabase.from("payments").select("*").eq("member_id", profile.member.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("invoices").select("*").eq("member_id", profile.member.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("refunds").select("*").eq("member_id", profile.member.id).order("created_at", { ascending: false }).limit(50)
  ]);

  const paymentRows = payments ?? [];
  const invoiceRows = invoices ?? [];
  const refundRows = refunds ?? [];
  const paidTotal = paymentRows.filter((payment) => payment.status === "paid").reduce((total, payment) => total + payment.amount, 0);
  const outstandingTotal = paymentRows.filter((payment) => payment.status === "pending" || payment.status === "processing" || payment.status === "failed").reduce((total, payment) => total + payment.amount, 0);
  const refundedTotal = refundRows.filter((refund) => refund.status === "processed" || refund.status === "processing").reduce((total, refund) => total + refund.amount, 0);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="member-info" className="w-fit gap-1.5 border-white/20 text-white">
              <Sparkles className="size-3.5" />
              Billing timeline
            </Badge>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Member finance</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Payments, invoices, and refunds</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72">
                Review your membership billing history, complete pending online payments, and track refund status in one secure member portal.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <Metric label="Paid" value={formatCurrency(paidTotal)} tone="emerald" />
            <Metric label="Outstanding" value={formatCurrency(outstandingTotal)} tone="amber" />
            <Metric label="Refunded" value={formatCurrency(refundedTotal)} tone="blue" />
          </div>
        </div>
      </section>

      <AnimatedCardSection>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard detail="Verified paid payments" icon={<CreditCard className="size-5" />} label="Paid" value={formatCurrency(paidTotal)} />
          <StatCard detail="Pending, processing, or failed payments" icon={<RefreshCcw className="size-5" />} label="Outstanding" value={formatCurrency(outstandingTotal)} />
          <StatCard detail="Processed or processing refunds" icon={<ReceiptText className="size-5" />} label="Refunded" value={formatCurrency(refundedTotal)} />
          <StatCard detail="Invoices linked to your account" icon={<FileText className="size-5" />} label="Invoices" value={String(invoiceRows.length)} />
        </section>
      </AnimatedCardSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {invoiceRows.filter((inv) => inv.status === "issued" || inv.status === "partially_paid").length > 0 ? (
            <AnimatedCardSection delay={0.08}>
              <Card variant="glass" className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Tag className="size-5 text-slate" />
                    <div>
                      <h3 className="text-2xl font-black">Promo Codes</h3>
                      <p className="text-sm text-slate">Apply a discount code to a pending invoice.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {invoiceRows.filter((inv) => inv.status === "issued" || inv.status === "partially_paid").map((inv) => (
                    <div key={inv.id} className="mb-4 last:mb-0 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate">
                            {inv.invoice_number} &middot; {formatCurrency(inv.total_amount ?? inv.amount_due, inv.currency)}
                          </p>
                          <p className="mt-1 text-sm font-bold text-white">Pending invoice ready for promotion.</p>
                        </div>
                        <ButtonLink href={`/member/payments/${inv.id}`} variant="secondary" size="sm">
                          Open details
                        </ButtonLink>
                      </div>
                      <CouponInput
                        amount={inv.total_amount ?? inv.amount_due}
                        invoiceId={inv.id}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </AnimatedCardSection>
          ) : null}

          <AnimatedCardSection delay={0.1}>
            <Card variant="glass" className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black">Payment History</h3>
                    <p className="text-sm leading-6 text-muted-foreground">Pending online payments can be completed here without contacting reception.</p>
                  </div>
                  <Badge variant="member-info" className="gap-1.5">
                    <ShieldCheck className="size-3.5" />
                    Secure records
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <AnimatedListSection>
                  {paymentRows.map((payment) => (
                    <AnimatedListItem key={payment.id}>
                      <MemberPaymentRow payment={payment} profile={profile.member} />
                    </AnimatedListItem>
                  ))}
                </AnimatedListSection>
                {paymentRows.length === 0 ? <EmptyState text="No payments are available yet." /> : null}
              </CardContent>
            </Card>
          </AnimatedCardSection>

          <div className="grid gap-5 xl:grid-cols-2">
            <AnimatedCardSection delay={0.15}>
              <Card variant="glass" className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black">Invoices</h3>
                      <p className="text-sm text-muted-foreground">Issued invoices, balances due, and archived PDFs.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invoiceRows.map((invoice) => <InvoiceRowItem invoice={invoice} key={invoice.id} />)}
                  {invoiceRows.length === 0 ? <EmptyState text="No invoices are available yet." /> : null}
                </CardContent>
              </Card>
            </AnimatedCardSection>

            <AnimatedCardSection delay={0.2}>
              <Card variant="glass" className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                      <ReceiptText className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black">Refunds</h3>
                      <p className="text-sm text-muted-foreground">Refund requests, processed refunds, and timestamps.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {refundRows.map((refund) => <RefundRowItem key={refund.id} refund={refund} />)}
                  {refundRows.length === 0 ? <EmptyState text="No refunds have been recorded." /> : null}
                </CardContent>
              </Card>
            </AnimatedCardSection>
          </div>
        </div>

        <aside className="space-y-6 self-start xl:sticky xl:top-6">
          <AnimatedCardSection delay={0.12}>
            <Card variant="glass-dark" className="border-white/10 bg-slate-950/80 text-white">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Sparkles className="size-5 text-cyan-300" />
                  <div>
                    <h3 className="text-2xl font-black">Recent Activity</h3>
                    <p className="text-sm text-white/60">Quick snapshot of your latest billing events.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {buildRecentActivity(paymentRows, invoiceRows, refundRows).map((item) => (
                  <ActivityItem key={item.key} item={item} />
                ))}
                {paymentRows.length === 0 && invoiceRows.length === 0 && refundRows.length === 0 ? (
                  <EmptyActivity text="No activity has been recorded yet." />
                ) : null}
              </CardContent>
            </Card>
          </AnimatedCardSection>
        </aside>
      </div>
    </div>
  );
}

function MemberPaymentRow({ payment, profile }: { payment: PaymentRow; profile: { email: string | null; full_name: string; phone: string } }) {
  const canCheckout = payment.provider === "razorpay" && (payment.status === "pending" || payment.status === "processing" || payment.status === "failed");

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface-muted p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center card-hover">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black">{payment.payment_number}</p>
          <StatusBadge status={payment.status} />
          <Badge variant="neutral">{payment.payment_type.replace(/_/g, " ")}</Badge>
          <ProviderBadge provider={payment.provider} />
        </div>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {payment.method.replace(/_/g, " ")} · {new Date(payment.created_at).toLocaleString("en-IN")}
        </p>
      </div>
      <p className="text-lg font-black">{formatCurrency(payment.amount, payment.currency)}</p>
      {canCheckout ? (
        <PaymentCheckoutButton
          amount={payment.amount}
          memberEmail={profile.email}
          memberName={profile.full_name}
          memberPhone={profile.phone}
          paymentId={payment.id}
        />
      ) : (
        <p className="text-xs font-bold text-muted-foreground">{payment.paid_at ? `Paid ${new Date(payment.paid_at).toLocaleDateString("en-IN")}` : "No action required"}</p>
      )}
    </div>
  );
}

function InvoiceRowItem({ invoice }: { invoice: InvoiceRow }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4 card-hover">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`/member/payments/${invoice.id}`} size="sm" variant="secondary" className="px-0 font-black">
              {invoice.invoice_number}
            </ButtonLink>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Issued {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString("en-IN") : new Date(invoice.created_at).toLocaleDateString("en-IN")}
          </p>
        </div>
        <p className="text-lg font-black">{formatCurrency(invoice.total_amount ?? 0, invoice.currency)}</p>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <Amount label="Paid" value={formatCurrency(invoice.amount_paid ?? 0, invoice.currency)} />
        <Amount label="Due" value={formatCurrency(invoice.amount_due ?? 0, invoice.currency)} />
        <Amount label="Discount" value={formatCurrency(invoice.discount_amount ?? 0, invoice.currency)} />
      </div>
      {invoice.pdf_path ? <p className="mt-3 text-xs font-semibold text-muted-foreground">PDF archived securely: {invoice.pdf_path}</p> : null}
    </div>
  );
}

function RefundRowItem({ refund }: { refund: RefundRow }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4 card-hover">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{refund.reason}</p>
            <StatusBadge status={refund.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Requested {new Date(refund.created_at).toLocaleDateString("en-IN")}
            {refund.processed_at ? ` · processed ${new Date(refund.processed_at).toLocaleDateString("en-IN")}` : ""}
          </p>
        </div>
        <p className="text-lg font-black">{formatCurrency(refund.amount, refund.currency)}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (["paid", "processed", "approved"].includes(status)) return <Badge variant="member-success">{status.replace(/_/g, " ")}</Badge>;
  if (["failed", "cancelled", "refunded"].includes(status)) return <Badge variant="member-error">{status.replace(/_/g, " ")}</Badge>;
  if (["pending", "processing", "partially_paid", "partially_refunded", "requested"].includes(status)) return <Badge variant="member-warning">{status.replace(/_/g, " ")}</Badge>;
  return <Badge variant="member-info">{status.replace(/_/g, " ")}</Badge>;
}

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">{label}</p>
      <p className="mt-1 font-bold text-mono-member">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm font-semibold text-slate">
      <div className="flex items-center gap-2">
        <Badge variant="neutral">No data</Badge>
      </div>
      <p className="mt-3 leading-6">{text}</p>
    </div>
  );
}

type RecentActivityItem = {
  key: string;
  title: string;
  detail: string;
  time: string;
  tone: "success" | "warning" | "info";
  href?: string;
};

function buildRecentActivity(payments: PaymentRow[], invoices: InvoiceRow[], refunds: RefundRow[]): RecentActivityItem[] {
  const rows: RecentActivityItem[] = [
    ...payments.map((payment) => ({
      key: `payment-${payment.id}`,
      title: payment.status === "paid" ? "Payment completed" : `Payment ${payment.status}`,
      detail: `${payment.payment_number} · ${formatCurrency(payment.amount, payment.currency)}`,
      time: payment.created_at,
      tone: payment.status === "paid" ? "success" : payment.status === "failed" ? "warning" : "info",
      href: payment.invoice_id ? `/member/payments/${payment.invoice_id}` : undefined,
    })),
    ...invoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      title: `Invoice ${invoice.status.replace(/_/g, " ")}`,
      detail: `${invoice.invoice_number} · ${formatCurrency(invoice.total_amount ?? invoice.amount_due ?? 0, invoice.currency)}`,
      time: invoice.updated_at ?? invoice.created_at,
      tone: invoice.status === "paid" ? "success" : invoice.status === "issued" ? "warning" : "info",
      href: `/member/payments/${invoice.id}`,
    })),
    ...refunds.map((refund) => ({
      key: `refund-${refund.id}`,
      title: `Refund ${refund.status}`,
      detail: `${refund.reason} · ${formatCurrency(refund.amount, refund.currency)}`,
      time: refund.created_at,
      tone: refund.status === "processed" ? "success" : refund.status === "requested" ? "warning" : "info",
    })),
  ];

  return rows
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);
}

function ActivityItem({ item }: { item: RecentActivityItem }) {
  const toneClass =
    item.tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : item.tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
        : "border-cyan-500/20 bg-cyan-500/10 text-cyan-100";

  const content = (
    <div className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">{item.title}</p>
          <p className="mt-1 text-xs leading-5 text-white/70">{item.detail}</p>
        </div>
        <Badge variant={item.tone === "success" ? "success" : item.tone === "warning" ? "warning" : "info"}>{item.tone}</Badge>
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{new Date(item.time).toLocaleDateString("en-IN")}</p>
    </div>
  );

  if (!item.href) return content;
  return <ButtonLink href={item.href} className="block p-0" variant="secondary">{content}</ButtonLink>;
}

function EmptyActivity({ text }: { text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">{text}</div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "blue" }) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-400/20 bg-emerald-500/10"
      : tone === "amber"
        ? "border-amber-400/20 bg-amber-500/10"
        : "border-blue-400/20 bg-blue-500/10";

  return (
    <div className={`rounded-2xl border ${toneClasses} p-4 backdrop-blur`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
