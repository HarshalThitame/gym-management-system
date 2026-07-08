import type { Metadata } from "next";
import { CreditCard, RefreshCcw, Shield, Tag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/features/billing/lib/money";
import { AutoRenewToggle } from "@/features/billing/components/auto-renew-toggle";
import { CouponInput } from "@/features/billing/components/coupon-input";
import { getAutoBillingStatus } from "@/features/billing/services/member-subscription-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection } from "@/features/member/components/page-wrappers";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanDurationDays } from "@/features/memberships/lib/plan-utils";
import { DeletePaymentMethodButton } from "@/app/(member)/member/payment-methods/delete-method-button";

export const metadata: Metadata = createMetadata({
  title: "Billing Settings",
  description: "Manage auto-renewal, saved payment methods, and subscription settings.",
  path: "/member/billing",
});

export default async function MemberBillingPage() {
  const context = await requireMemberPortalAccess("/member/billing");

  const supabase = await createSupabaseServerClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, membership_plan_id, auto_renew, total_amount, status, start_date, end_date")
    .eq("member_id", context.userId)
    .in("status", ["active", "suspended"])
    .order("created_at", { ascending: false })
    .limit(1) as never as {
    data: Array<{
      id: string;
      membership_plan_id: string;
      auto_renew: boolean;
      total_amount: number;
      status: string;
      start_date: string;
      end_date: string;
    }> | null;
    error: unknown;
  };

  const membership = memberships?.[0] ?? null;
  let plan = null;
  let autoBillingStatus = null;

  if (membership) {
    const { data: planData } = await supabase
      .from("membership_plans")
      .select("id, name, price_amount, plan_type, duration_days, currency")
      .eq("id", membership.membership_plan_id)
      .maybeSingle() as never as {
      data: { id: string; name: string; price_amount: number; plan_type: string; duration_days: number; currency: string } | null;
      error: unknown;
    };
    plan = planData;

    const statusResult = await getAutoBillingStatus(context.userId, membership.id);
    if (statusResult.ok) autoBillingStatus = statusResult.status;
  }

  const { data: paymentMethods } = await supabase
    .from("member_payment_methods")
    .select("*")
    .eq("member_id", context.userId)
    .eq("is_active", true)
    .order("is_default", { ascending: false }) as never as {
    data: Array<{
      id: string;
      provider: string;
      payment_type: string;
      display_name: string;
      last_four: string | null;
      card_network: string | null;
      expiry_month: number | null;
      expiry_year: number | null;
      is_default: boolean;
    }> | null;
    error: unknown;
  };

  const { data: subscriptions } = await supabase
    .from("member_subscriptions")
    .select("*")
    .eq("member_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(5) as never as {
    data: Array<{
      id: string;
      status: string;
      provider: string;
      billing_period: string;
      amount: number;
      currency: string;
      current_period_end: string | null;
      next_charge_at: string | null;
      last_charged_at: string | null;
      failure_count: number;
      last_failure_reason: string | null;
      created_at: string;
    }> | null;
    error: unknown;
  };

  const activeSub = (subscriptions ?? []).find((s) => s.status === "active");

  const { data: pendingInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, amount_due, discount_amount, status")
    .eq("member_id", context.userId)
    .in("status", ["issued", "partially_paid"])
    .order("created_at", { ascending: false })
    .limit(5) as never as {
    data: Array<{ id: string; invoice_number: string; total_amount: number | null; amount_due: number; discount_amount: number; status: string }> | null;
    error: unknown;
  };

  const firstPendingInvoice = pendingInvoices?.[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing Settings" description="Manage your auto-renewal preferences, saved payment methods, and subscription details." />

      {membership && plan && autoBillingStatus ? (
        <AnimatedCardSection>
          <Card variant="glass">
            <CardHeader>
              <div className="flex items-center gap-3">
                <RefreshCcw className="size-5 text-slate" />
                <div>
                  <h2 className="text-2xl font-black">Auto-Renewal</h2>
                  <p className="text-sm text-slate">
                    {plan.name} &middot; {formatCurrency(plan.price_amount, plan.currency)} / {getPlanDurationDays(plan.plan_type)} days
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AutoRenewToggle
                membershipId={membership.id}
                planPrice={plan.price_amount}
                planDurationDays={getPlanDurationDays(plan.plan_type)}
                initialAutoRenew={membership.auto_renew}
                initialStatus={autoBillingStatus}
              />
            </CardContent>
          </Card>
        </AnimatedCardSection>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <AnimatedCardSection>
          <Card variant="glass">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CreditCard className="size-5 text-slate" />
                <div>
                  <h2 className="text-2xl font-black">Payment Methods</h2>
                  <p className="text-sm text-slate">Cards saved via Razorpay for recurring charges.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!paymentMethods || paymentMethods.length === 0 ? (
                <EmptyState simple text="No saved payment methods. Enable auto-renewal above to set up recurring payments." />
              ) : (
                paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <p className="font-bold text-white">
                        {method.display_name}
                        {method.is_default ? <Badge variant="success" className="ml-2">Default</Badge> : null}
                      </p>
                      <p className="text-xs text-slate">
                        {method.payment_type.replace(/_/g, " ")}
                        {method.last_four ? ` · ending in ${method.last_four}` : ""}
                        {method.expiry_month && method.expiry_year ? ` · expires ${method.expiry_month}/${method.expiry_year}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={method.provider === "razorpay" ? "info" : "warning"}>
                        {method.provider}
                      </Badge>
                      <DeletePaymentMethodButton methodId={method.id} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection>
          <Card variant="glass">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-slate" />
                <div>
                  <h2 className="text-2xl font-black">Subscription</h2>
                  <p className="text-sm text-slate">Recurring billing status and history.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!activeSub ? (
                <EmptyState simple text="No active recurring subscription. Enable auto-renewal to set one up." />
              ) : (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate">Status</p>
                        <p className="mt-1 font-bold text-white capitalize">{activeSub.status}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate">Provider</p>
                        <p className="mt-1 font-bold text-white capitalize">{activeSub.provider}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate">Amount</p>
                        <p className="mt-1 font-bold text-white">{formatCurrency(activeSub.amount, activeSub.currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate">Billing Period</p>
                        <p className="mt-1 font-bold text-white capitalize">{activeSub.billing_period.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate">Next Charge</p>
                        <p className="mt-1 font-bold text-white">
                          {activeSub.next_charge_at ? new Date(activeSub.next_charge_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate">Last Charged</p>
                        <p className="mt-1 font-bold text-white">
                          {activeSub.last_charged_at ? new Date(activeSub.last_charged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                        </p>
                      </div>
                    </div>
                    {activeSub.failure_count > 0 ? (
                      <p className="mt-3 text-xs font-semibold text-red-400">
                        {activeSub.failure_count} failed charge{activeSub.failure_count === 1 ? "" : "s"}
                        {activeSub.last_failure_reason ? `: ${activeSub.last_failure_reason.slice(0, 100)}` : ""}
                      </p>
                    ) : null}
                  </div>

                  {subscriptions && subscriptions.length > 1 ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate">History</p>
                      <div className="space-y-2">
                        {subscriptions.map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                            <span className="capitalize text-white">{sub.status}</span>
                            <span className="text-slate">
                              {sub.created_at ? new Date(sub.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </span>
                            <span className="font-semibold text-white">{formatCurrency(sub.amount, sub.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </AnimatedCardSection>
      </div>

      {firstPendingInvoice ? (
        <AnimatedCardSection>
          <Card variant="glass">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Tag className="size-5 text-slate" />
                <div>
                  <h2 className="text-2xl font-black">Promo Codes</h2>
                  <p className="text-sm text-slate">Apply a promo code to your pending invoice.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-slate">
                Invoice: {firstPendingInvoice.invoice_number} &middot; {formatCurrency(firstPendingInvoice.total_amount ?? firstPendingInvoice.amount_due)}
              </p>
              <CouponInput
                amount={firstPendingInvoice.total_amount ?? firstPendingInvoice.amount_due}
                invoiceId={firstPendingInvoice.id}
              />
            </CardContent>
          </Card>
        </AnimatedCardSection>
      ) : null}
    </div>
  );
}
