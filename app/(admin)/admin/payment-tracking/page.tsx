import type { Metadata } from "next";
import { ArrowUpRight, Banknote, CreditCard, Landmark, Shield, Smartphone, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/features/billing/lib/money";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import { getPaymentTrackingSummary } from "@/features/billing/services/payment-tracking-service";

export const metadata: Metadata = createMetadata({
  title: "Payment Tracking",
  description: "Track and analyze payment methods, success rates, and daily trends.",
  path: "/admin/payment-tracking",
});

const METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote className="size-5" />,
  upi: <Smartphone className="size-5" />,
  credit_card: <CreditCard className="size-5" />,
  debit_card: <CreditCard className="size-5" />,
  net_banking: <Landmark className="size-5" />,
  razorpay: <Wallet className="size-5" />,
};

export default async function PaymentTrackingPage() {
  const scope = await requireGymAdminScope("/admin/payment-tracking");
  await requireOrganizationFeatureAccess({ organizationId: scope.organizationId, featureKey: "payment_tracking", actionName: "admin.payment-tracking.read" });

  const summary = await getPaymentTrackingSummary(scope.gymId);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Analytics</p>
        <h2 className="mt-2 text-3xl font-black">Payment Tracking</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Breakdown of payment methods, success rates, and daily collection trends for the last 30 days.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total payment volume" icon={<Wallet className="size-5" />} label="Total Volume" value={formatCurrency(summary.totalAmount)} />
        <StatCard detail="Successfully collected" icon={<ArrowUpRight className="size-5" />} label="Collected" value={formatCurrency(summary.paidAmount)} />
        <StatCard
          detail={`${summary.last30DaysPaid} paid / ${summary.last30DaysFailed} failed`}
          icon={<ArrowUpRight className="size-5" />}
          label="Success Rate"
          value={`${summary.successRate.toFixed(1)}%`}
        />
        <StatCard detail="Processed refunds" icon={<ArrowUpRight className="size-5" />} label="Refunded" value={formatCurrency(summary.refundedAmount)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">By Payment Method</h3>
            <p className="text-sm text-muted-foreground">Breakdown of volume and success by payment mode.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.methodBreakdown.length === 0 && (
              <EmptyState simple text="No payment data available for the last 30 days." />
            )}
            {summary.methodBreakdown.map((m) => (
              <div key={m.method} className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">{METHOD_ICONS[m.method] ?? <Wallet className="size-5" />}</div>
                  <div>
                    <p className="font-black capitalize">{m.method.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.count} transactions &middot; {m.paidCount} paid &middot; {m.failedCount} failed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black">{formatCurrency(m.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{m.count > 0 ? `${((m.paidCount / m.count) * 100).toFixed(0)}% success` : "—"}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">By Payment Provider</h3>
            <p className="text-sm text-muted-foreground">Breakdown of volume and success by gateway provider.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.providerBreakdown.length === 0 && (
              <EmptyState simple text="No payment data available for the last 30 days." />
            )}
            {summary.providerBreakdown.map((p) => (
              <div key={p.provider} className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">
                    {p.provider === "razorpay" ? <Wallet className="size-5" /> : <Shield className="size-5" />}
                  </div>
                  <div>
                    <p className="font-black capitalize">{p.provider}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.count} transactions &middot; {p.paidCount} paid &middot; {p.failedCount} failed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black">{formatCurrency(p.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{p.count > 0 ? `${((p.paidCount / p.count) * 100).toFixed(0)}% success` : "—"}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Daily Collection Trend</h3>
          <p className="text-sm text-muted-foreground">Last 30 days of paid collections.</p>
        </CardHeader>
        <CardContent className="space-y-1">
            {summary.dailyTrend.length === 0 && (
              <EmptyState simple text="No collection data yet." />
            )}
          {summary.dailyTrend.slice(-14).map((day) => (
            <div key={day.date} className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-muted-foreground">
                {new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <div className="flex items-center gap-3">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min((day.amount / Math.max(...summary.dailyTrend.map((d) => d.amount), 1)) * 100, 100)}px` }} />
                <span className="w-20 text-right text-xs font-black">{formatCurrency(day.amount)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
