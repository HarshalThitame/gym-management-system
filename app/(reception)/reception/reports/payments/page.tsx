import type { Metadata } from "next";
import { ArrowLeft, CreditCard, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { listReceptionPayments } from "@/features/reception/services/reception-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Payments Report",
  description: "Daily payment collection report for front desk.",
  path: "/reception/reports/payments"
});

export default async function PaymentsReportPage() {
  const scope = await requireReceptionScope("/reception/reports/payments");
  const payments = await listReceptionPayments(scope.gymId, {
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
  });
  const paidPayments = payments.filter((p) => p.status === "paid");
  const totalCollected = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const cashPayments = paidPayments.filter((p) => p.method === "cash").length;
  const upiPayments = paidPayments.filter((p) => p.method === "upi").length;

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/reports" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reports</p>
          <h2 className="text-2xl font-black">Payments Report</h2>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total paid" icon={<CreditCard className="size-5" />} label="Paid Payments" value={String(paidPayments.length)} />
        <StatCard detail="Total collected" icon={<ReceiptText className="size-5" />} label="Collected" value={formatCurrency(totalCollected)} />
        <StatCard detail="Cash payments" icon={<CreditCard className="size-5" />} label="Cash" value={String(cashPayments)} />
        <StatCard detail="UPI/Card payments" icon={<ReceiptText className="size-5" />} label="UPI / Card" value={String(upiPayments)} />
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Payment History</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.map((payment) => (
            <div className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 md:grid-cols-[1fr_auto_auto] md:items-center" key={payment.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{payment.payment_number}</p>
                  {payment.status === "paid" ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">{payment.status}</Badge>}
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {payment.payment_type.replaceAll("_", " ")} · {payment.method.replaceAll("_", " ")} · {new Date(payment.created_at).toLocaleString("en-IN")}
                </p>
              </div>
              <p className="font-black">{formatCurrency(payment.amount, payment.currency)}</p>
              <p className="text-xs font-bold text-muted-foreground">{payment.provider}</p>
            </div>
          ))}
          {payments.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
              No payment records available.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
