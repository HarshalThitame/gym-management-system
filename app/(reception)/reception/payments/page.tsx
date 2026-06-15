import type { Metadata } from "next";
import { CreditCard, ReceiptText, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { listReceptionPayments } from "@/features/reception/services/reception-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Payments",
  description: "Reception payment collection workspace for assigned branch front desk operations.",
  path: "/reception/payments"
});

export default async function ReceptionPaymentsPage() {
  const scope = await requireReceptionScope("/reception/payments");
  const payments = await listReceptionPayments(scope.gymId);
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const pendingPayments = payments.filter((payment) => payment.status === "pending" || payment.status === "processing" || payment.status === "failed");
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPayments = paidPayments.filter((payment) => (payment.paid_at ?? payment.collected_at ?? payment.created_at).startsWith(todayKey));

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Payments</p>
        <h2 className="mt-2 text-3xl font-black">Payment collection</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">View assigned branch payment history, pending dues, receipts, and front-desk collection state. Refunds and revenue analytics remain blocked.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Paid payments collected today" icon={<CreditCard className="size-5" />} label="Today's Payments" value={String(todayPayments.length)} />
        <StatCard detail="Pending, processing, or failed rows" icon={<RefreshCcw className="size-5" />} label="Pending Dues" value={String(pendingPayments.length)} />
        <StatCard detail="Paid amount in recent payment window" icon={<ReceiptText className="size-5" />} label="Collected" value={formatCurrency(paidPayments.reduce((total, payment) => total + payment.amount, 0))} />
      </section>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Payment History</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.map((payment) => (
            <div className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 md:grid-cols-[1fr_auto_auto] md:items-center" key={payment.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{payment.payment_number}</p>
                  <PaymentStatus status={payment.status} />
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{payment.payment_type.replaceAll("_", " ")} · {payment.method.replaceAll("_", " ")} · {new Date(payment.created_at).toLocaleString("en-IN")}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Receipt: {payment.receipt_number ?? "pending"}</p>
              </div>
              <p className="font-black">{formatCurrency(payment.amount, payment.currency)}</p>
              <p className="text-xs font-bold text-muted-foreground">{payment.provider}</p>
            </div>
          ))}
          {payments.length === 0 ? <EmptyState text="No payment rows are available for this gym yet." /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentStatus({ status }: { status: "pending" | "processing" | "paid" | "failed" | "refunded" | "partially_refunded" | "cancelled" }) {
  if (status === "paid") return <Badge variant="success">paid</Badge>;
  if (status === "failed" || status === "cancelled" || status === "refunded") return <Badge variant="error">{status.replaceAll("_", " ")}</Badge>;
  return <Badge variant="warning">{status.replaceAll("_", " ")}</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
