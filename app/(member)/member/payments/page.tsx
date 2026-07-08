import type { Metadata } from "next";
import { CreditCard, FileText, ReceiptText, RefreshCcw, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProviderBadge } from "@/features/billing/components/provider-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { PaymentCheckoutButton } from "@/features/billing/components/payment-checkout-button";
import { CouponInput } from "@/features/billing/components/coupon-input";
import { formatCurrency } from "@/features/billing/lib/money";
import { getMemberDashboard } from "@/features/memberships/services/membership-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection, AnimatedListSection, AnimatedListItem } from "@/features/member/components/page-wrappers";
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
      <PageHeader eyebrow="Billing" title="Payments, invoices, and refunds" description="Review your membership billing history, complete pending online payments, and track refund status." />

      <AnimatedCardSection>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard detail="Verified paid payments" icon={<CreditCard className="size-5" />} label="Paid" value={formatCurrency(paidTotal)} />
          <StatCard detail="Pending, processing, or failed payments" icon={<RefreshCcw className="size-5" />} label="Outstanding" value={formatCurrency(outstandingTotal)} />
          <StatCard detail="Processed or processing refunds" icon={<ReceiptText className="size-5" />} label="Refunded" value={formatCurrency(refundedTotal)} />
          <StatCard detail="Invoices linked to your account" icon={<FileText className="size-5" />} label="Invoices" value={String(invoiceRows.length)} />
        </section>
      </AnimatedCardSection>

      {invoiceRows.filter((inv) => inv.status === "issued" || inv.status === "partially_paid").length > 0 ? (
        <AnimatedCardSection delay={0.08}>
          <Card variant="glass">
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
                <div key={inv.id} className="mb-4 last:mb-0">
                  <p className="mb-2 text-xs font-semibold text-slate">
                    {inv.invoice_number} &middot; {formatCurrency(inv.total_amount ?? inv.amount_due, inv.currency)}
                  </p>
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
        <Card variant="glass">
          <CardHeader>
            <h3 className="text-2xl font-black">Payment History</h3>
            <p className="text-sm leading-6 text-muted-foreground">Pending Razorpay payments can be completed here without contacting reception.</p>
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
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Invoices</h3></CardHeader>
            <CardContent className="space-y-3">
              {invoiceRows.map((invoice) => <InvoiceRowItem invoice={invoice} key={invoice.id} />)}
              {invoiceRows.length === 0 ? <EmptyState text="No invoices are available yet." /> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection delay={0.2}>
          <Card variant="glass">
            <CardHeader><h3 className="text-2xl font-black">Refunds</h3></CardHeader>
            <CardContent className="space-y-3">
              {refundRows.map((refund) => <RefundRowItem key={refund.id} refund={refund} />)}
              {refundRows.length === 0 ? <EmptyState text="No refunds have been recorded." /> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>
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
            <p className="font-black">{invoice.invoice_number}</p>
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
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm font-semibold text-slate">{text}</div>;
}
