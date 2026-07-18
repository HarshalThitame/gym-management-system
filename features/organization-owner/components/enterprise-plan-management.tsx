"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, CreditCard, LineChart, Loader2, Minus, Plus, ReceiptText, RefreshCw, XCircle, Users, Briefcase, Calendar, MessageSquare, BarChart3, Smartphone, Lock, Sparkles } from "lucide-react";
import { LineChart as RechartsLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { toggleAutoRenewAction, cancelSubscriptionAction, reactivateSubscriptionAction } from "@/features/organization-owner/actions/plan-actions";
import { OrganizationPlanOneTimeCheckout } from "@/features/organization-owner/components/organization-plan-one-time-checkout";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import type { PackageWithMeta, SubscriptionWithPackage, UsageHistoryPoint, OrgUsageData } from "@/features/organization-owner/actions/plan-data-actions";
import type { OrgPlanOneTimeCheckoutState } from "@/features/organization-owner/actions/plan-one-time-actions";
import { FeatureCard, FeatureCategorySection, LimitBar } from "@/components/ui/feature-card";
import { FEATURE_CATEGORIES } from "@/features/subscription/feature-definitions";
import { cn } from "@/lib/utils";

type EnterprisePlanManagementProps = {
  planContext: OrgPlanContext;
  allPackages: PackageWithMeta[];
  currentSubscription: SubscriptionWithPackage | null;
  usageHistory: UsageHistoryPoint[];
  orgUsage: OrgUsageData | null;
  organizationName?: string;
  customerEmail?: string;
  invoices?: any[];
  payments?: any[];
  pendingCheckout?: OrgPlanOneTimeCheckoutState | null;
};

const CATEGORY_ICONS: Record<string, any> = {
  members: Users,
  billing: CreditCard,
  classes: Calendar,
  staff: Briefcase,
  communication: MessageSquare,
  reports: BarChart3,
  portal: Smartphone,
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function EnterprisePlanManagement({ planContext, allPackages, currentSubscription, usageHistory, orgUsage, organizationName = "", customerEmail = "", invoices = [], payments = [], pendingCheckout = null }: EnterprisePlanManagementProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "compare" | "usage" | "pay" | "billing" | "features" | "timeline">("overview");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showCancel, setShowCancel] = useState(false);
  const [pendingCheckoutPackageId, setPendingCheckoutPackageId] = useState<string | null>(null);
  const [, autoRenewAction, autoRenewPending] = useActionState(toggleAutoRenewAction, initialAuthActionState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelSubscriptionAction, initialAuthActionState);
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(reactivateSubscriptionAction, initialAuthActionState);

  // Close cancel modal on success and show toast for reactivate success
  useEffect(() => {
    if (cancelState.status === "success") {
      setShowCancel(false);
    }
  }, [cancelState.status]);
  useEffect(() => {
    if (reactivateState.status === "success") {
      showToast(reactivateState.message ?? "Subscription reactivated.", "success");
    }
  }, [reactivateState.status, reactivateState.message]);

  const isActive = planContext.status === "active";
  const isTrialing = planContext.isTrialing;
  const isSuspended = planContext.isSuspended;
  const hasCurrentSubscription = Boolean(currentSubscription);
  const canManageSubscription = hasCurrentSubscription && (currentSubscription?.status === "active" || currentSubscription?.status === "trial");
  const isCancelled = planContext.status === "cancelled" || currentSubscription?.status === "cancelled";
  const cancelledAt = currentSubscription ? (currentSubscription as unknown as { cancelled_at: string | null }).cancelled_at : null;
  const hasPendingCancel = !isCancelled && cancelledAt != null;
  const scheduledEndDate = hasPendingCancel ? new Date(cancelledAt!) : null;
  const autoRenew = currentSubscription ? (currentSubscription as unknown as { auto_renew: boolean }).auto_renew : null;
  const billingEngine = currentSubscription ? (currentSubscription as unknown as { billing_engine?: string | null }).billing_engine : null;
  const providerSubscriptionId = currentSubscription ? (currentSubscription as unknown as { provider_subscription_id?: string | null }).provider_subscription_id : null;
  const providerMandateId = currentSubscription ? (currentSubscription as unknown as { provider_mandate_id?: string | null }).provider_mandate_id : null;

  const currentPkg = currentSubscription
    ? allPackages.find((p) => p.id === currentSubscription.package_id) ?? null
    : null;

  // Get features/limits from the enriched allPackages data (raw subscription has no _features)
  const currentPkgFeatures = useMemo(() => {
    if (!currentPkg?._features) return {};
    return currentPkg._features;
  }, [currentPkg]);

  const trialDaysRemaining = useMemo(() => {
    if (!planContext.trialEndsAt) return null;
    return Math.max(0, Math.ceil((planContext.trialEndsAt.getTime() - Date.now()) / 86400000));
  }, [planContext.trialEndsAt]);

  const isYearly = billingCycle === "yearly";

  const handleComparePlanPay = useCallback((targetPackageId: string) => {
    setPendingCheckoutPackageId(targetPackageId);
    setActiveTab("pay");
  }, []);

  const handleToggleAutoRenew = useCallback(() => {
    if (!canManageSubscription || hasPendingCancel || autoRenew === null) return;
    const fd = new FormData();
    fd.set("enabled", String(!autoRenew));
    autoRenewAction(fd);
  }, [autoRenew, autoRenewAction, canManageSubscription, hasPendingCancel]);

  return (
    <div className="space-y-8">
      <ToastContainer />

      {isCancelled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="text-xs font-black uppercase tracking-[0.14em]">Subscription cancelled</p>
          <h3 className="mt-1 text-lg font-black">Billing access is retained for the cancellation window</h3>
          <p className="mt-2 text-sm text-amber-900/80">
            You can still review invoices, payments, and plan history while the retention period is active.
            Reactivate or choose a new plan to restore full platform access.
          </p>
        </div>
      ) : hasPendingCancel && scheduledEndDate ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-blue-900">
          <p className="text-xs font-black uppercase tracking-[0.14em]">Cancellation scheduled</p>
          <h3 className="mt-1 text-lg font-black">Your plan remains active until {scheduledEndDate.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</h3>
          <p className="mt-2 text-sm text-blue-900/80">
            Auto-renewal has been turned off. Full platform access continues until the scheduled cancellation date.
            You can reactivate before then to keep your plan.
          </p>
        </div>
      ) : null}

      {/* Trial Banner */}
      {isTrialing && trialDaysRemaining !== null ? (
        <div className={`rounded-lg border p-5 ${trialDaysRemaining <= 3 ? "border-red-200 bg-red-50" : "border-cyan-200 bg-cyan-50"}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Clock className={`mt-0.5 size-5 ${trialDaysRemaining <= 3 ? "text-red-500" : "text-cyan-500"}`} />
              <div>
                <p className={`text-sm font-bold ${trialDaysRemaining <= 3 ? "text-red-800" : "text-cyan-900"}`}>
                  Trial ends in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}
                </p>
                <p className={`text-sm ${trialDaysRemaining <= 3 ? "text-red-700" : "text-cyan-700"}`}>
                  {trialDaysRemaining <= 3 ? "Choose a plan to avoid service interruption." : "Explore plans to find the best fit."}
                </p>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" onClick={() => setActiveTab("compare")} type="button">View Plans & Upgrade</button>
          </div>
        </div>
      ) : null}

      {/* Failed Payment Banner */}
      {(() => {
        const failedInv = invoices.find((i: any) => i.status === "failed" || i.dunning_status === "payment_failed" || i.dunning_status === "overdue");
        if (!failedInv || isSuspended) return null;
        const dunningLabel = failedInv.dunning_status === "overdue" ? "Overdue" : failedInv.dunning_status === "grace_period" ? "Grace Period" : "Failed";
        return (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Payment {dunningLabel}</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Invoice {failedInv.invoice_number ?? ""} — ₹{Intl.NumberFormat("en-IN").format(Math.round((failedInv.total_amount ?? failedInv.subtotal_amount ?? 0) / 100))}
                  {failedInv.due_at ? ` · Due ${new Date(failedInv.due_at).toLocaleDateString("en-IN")}` : ""}
                  {failedInv.dunning_grace_period_ends_at ? ` · Grace until ${new Date(failedInv.dunning_grace_period_ends_at).toLocaleDateString("en-IN")}` : ""}
                </p>
              </div>
              <button onClick={() => setActiveTab("pay")} className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700" type="button">Pay Now</button>
            </div>
          </div>
        );
      })()}

      {/* Suspended Banner */}
      {isSuspended ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
            <div><p className="text-sm font-bold text-red-800">Subscription Suspended</p><p className="text-sm text-red-700">Features are locked. Contact support to reactivate.</p></div>
          </div>
        </div>
      ) : null}

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["overview", "usage", "features", "compare", "pay", "billing", "timeline"] as const).map((tab) => (
          <button key={tab} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab} type="button">
            {tab === "overview" ? "Overview" : tab === "usage" ? "Usage" : tab === "features" ? "Features" : tab === "compare" ? "Compare Plans" : tab === "pay" ? "Pay" : tab === "billing" ? "Billing" : "Timeline"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Current Plan */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><CreditCard className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Current Plan</h2></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Package</p>
                    <p className="mt-1 text-3xl font-black">{currentPkg?.name ?? planContext.packageName}</p>
                    {currentPkg?.description ? <p className="mt-1 text-xs text-muted-foreground">{currentPkg.description}</p> : null}
                    {/* Pricing Display */}
                    {(() => {
                      const pkgAny = currentPkg as any;
                      const pricing = pkgAny?._pricing ?? [];
                      const monthlyPrice = pricing.find((p: any) => p.billing_period === "monthly")?.price ?? 0;
                      const annualPricing = pricing.find((p: any) => p.billing_period === "annual");
                      if (currentPkg?.name === "Enterprise") {
                        return <p className="mt-2 text-lg font-black">Custom Pricing</p>;
                      }
                      if (annualPricing) {
                        return (
                          <div className="mt-2">
                            <p className="text-lg font-black">₹{Intl.NumberFormat("en-IN").format(Math.round(annualPricing.price / 100))}<span className="text-sm font-normal text-muted-foreground">/year</span></p>
                            <p className="text-xs text-green-600 font-semibold">₹{Intl.NumberFormat("en-IN").format(Math.round(monthlyPrice / 100))}/mo · Save {Math.round((1 - annualPricing.price / (monthlyPrice * 12 || 1)) * 100)}%</p>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-2">
                          <p className="text-lg font-black">₹{Intl.NumberFormat("en-IN").format(Math.round(monthlyPrice / 100))}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                        </div>
                      );
                    })()}
                  </div>
                  {currentPkg ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${(currentPkg as unknown as { recommended: boolean }).recommended ? "bg-amber-100 text-amber-700" : "bg-surface-muted text-muted-foreground"}`}>
                      {(currentPkg as unknown as { recommended: boolean }).recommended ? "Recommended" : "Current"}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</p><Badge className="mt-1" variant={isActive ? "success" : isTrialing ? "info" : "error"}>{planContext.status}</Badge></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Auto-Renew</p>
                    {canManageSubscription && autoRenew !== null ? (
                      <button className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${autoRenew ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} disabled={autoRenewPending} onClick={handleToggleAutoRenew} type="button">
                        {autoRenewPending ? <Loader2 className="size-3 animate-spin" /> : null}
                        {autoRenew ? "Enabled" : "Disabled"} <RefreshCw className="size-3" />
                      </button>
                    ) : (
                      <span className="mt-1 inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                        Not available
                      </span>
                    )}
                  </div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Renewal</p><p className="mt-1 text-sm font-bold">{planContext.expiresAt ? planContext.expiresAt.toLocaleDateString("en-IN") : "No expiry"}</p></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Billing Engine</p><p className="mt-1 text-sm font-bold">{billingEngine === "subscription" ? "Auto-debit" : "Invoice renewal"}</p></div>
                </div>
                {billingEngine === "subscription" ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <p className="font-bold">Mandate-based recurring billing is active.</p>
                    <p className="mt-1 break-all">Subscription {providerSubscriptionId ?? "—"}{providerMandateId ? ` · Mandate ${providerMandateId}` : ""}</p>
                  </div>
                ) : null}
                {/* Trial Status */}
                {isTrialing && trialDaysRemaining !== null && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-cyan-50 border border-cyan-200 p-2">
                    <Clock className="size-4 text-cyan-600" />
                    <div>
                      <p className="text-xs font-bold text-cyan-800">
                        Trial · {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} remaining
                      </p>
                      <p className="text-[10px] text-cyan-600">
                        {planContext.trialEndsAt ? `Expires ${planContext.trialEndsAt.toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                  </div>
                )}
                {currentPkg?.name === "Enterprise" && !isTrialing && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-purple-50 border border-purple-200 p-2">
                    <Sparkles className="size-4 text-purple-600" />
                    <p className="text-xs font-bold text-purple-800">Custom contract · Contact Sales</p>
                  </div>
                )}
                <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" onClick={() => setActiveTab("usage")} type="button">View Usage & Limits</button>
              </CardContent>
            </Card>

            {/* Usage Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><LineChart className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Usage Summary</h2></div>
              </CardHeader>
              <CardContent className="space-y-4">
                {orgUsage ? (
                  <>
                    <LimitBar label="Active Members" current={orgUsage.memberCount} limit={orgUsage.memberLimit} />
                    <LimitBar label="Staff Users" current={orgUsage.staffCount} limit={orgUsage.staffLimit} />
                    <LimitBar label="SMS Used" current={orgUsage.smsUsed} limit={orgUsage.smsLimit} />
                    {usageHistory.length >= 2 && (
                      <div className="h-32 w-full mt-2">
                        <ResponsiveContainer height="100%" width="100%">
                          <RechartsLine data={usageHistory}>
                            <Tooltip />
                            <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} type="monotone" name="Members" />
                          </RechartsLine>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No usage data available.</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Plus className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Quick Actions</h2></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <button onClick={() => setActiveTab("compare")} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" type="button">Compare Plans & Upgrade</button>
                <button onClick={() => setActiveTab("features")} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-bold transition-all hover:bg-accent/10" type="button">View Features</button>
                <button onClick={() => setActiveTab("billing")} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-bold transition-all hover:bg-accent/10" type="button">Billing & Invoices</button>
                {canManageSubscription ? (
                  <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-all hover:bg-red-100" onClick={() => setShowCancel(true)} type="button">Cancel Subscription</button>
                ) : (
                  <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-bold text-muted-foreground" onClick={() => setActiveTab("compare")} type="button">Choose a Plan</button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TAB: USAGE ═══ */}
      {activeTab === "usage" && orgUsage && (
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-2xl font-black">Resource Usage</h2><p className="text-sm text-muted-foreground">Usage vs plan limits for {currentPkg?.name ?? planContext.packageName}</p></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <LimitBar label="Active Members" current={orgUsage.memberCount} limit={orgUsage.memberLimit} limitLabel="Up to 200 active members" />
                <LimitBar label="Staff Users" current={orgUsage.staffCount} limit={orgUsage.staffLimit} limitLabel="Up to 3 staff users" />
                <LimitBar label="Membership Plans" current={orgUsage.planTypesCount} limit={orgUsage.planTypesLimit} limitLabel="Up to 10 plan types" />
                <LimitBar label="Weekly Classes" current={orgUsage.weeklyClasses} limit={orgUsage.weeklyClassesLimit} limitLabel="Up to 5 classes per week" />
                <LimitBar label="SMS Used (Monthly)" current={orgUsage.smsUsed} limit={orgUsage.smsLimit} limitLabel="Up to 500 SMS per month" />
                <LimitBar label="Gyms" current={orgUsage.branchCount} limit={orgUsage.branchLimit} limitLabel="Single gym" />
              </div>

              {usageHistory.length >= 2 && (
                <div className="mt-6">
                  <h3 className="text-base font-black mb-3">Member Growth (6 months)</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer height="100%" width="100%">
                      <RechartsLine data={usageHistory}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} type="monotone" name="Members" />
                      </RechartsLine>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {orgUsage.memberPercent >= 80 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-800">You are approaching your plan limit</p>
                  <p className="text-xs text-amber-700 mt-1">Consider upgrading to unlock more capacity and features.</p>
                  <button onClick={() => setActiveTab("compare")} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" type="button">Upgrade Plan</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: FEATURES ═══ */}
      {activeTab === "features" && (
        <div className="space-y-5">
          <Card>
            <CardHeader><h2 className="text-2xl font-black">Plan Features</h2><p className="text-sm text-muted-foreground">Features included in your {currentPkg?.name ?? planContext.packageName} plan</p></CardHeader>
            <CardContent className="space-y-6">
              {FEATURE_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] ?? Check;
                const catFeatures = cat.features.map((f) => ({
                  ...f,
                  included: currentPkgFeatures[f.featureCode] === true || currentPkgFeatures[f.featureCode] === "true",
                }));
                if (catFeatures.length === 0) return null;
                return (
                  <FeatureCategorySection
                    key={cat.id}
                    name={cat.name}
                    description={cat.description}
                    icon={<Icon className="size-4" />}
                  >
                    {catFeatures.map((f, idx) => (
                      <FeatureCard
                        key={`${f.featureCode}-${idx}`}
                        label={f.label}
                        description={f.description}
                        included={f.included}
                        {...(f.included ? {} : { upgradeLabel: f.upgradeLabel ?? "Locked" })}
                        {...(f.included && f.limitLabel ? { limitLabel: f.limitLabel } : {})}
                      />
                    ))}
                  </FeatureCategorySection>
                );
              })}
            </CardContent>
          </Card>

          {/* Locked features call to action */}
          {currentPkg && (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Lock className="size-8 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-black">Need more features?</h3>
                    <p className="text-sm text-muted-foreground">Unlock premium features by upgrading to a higher plan.</p>
                  </div>
                  <button onClick={() => setActiveTab("compare")} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm" type="button">Compare Plans & Upgrade</button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ TAB: PAY ═══ */}
      {activeTab === "pay" && (
        <div className="space-y-6">
          <OrganizationPlanOneTimeCheckout
            organizationName={organizationName}
            customerEmail={customerEmail}
            allPackages={allPackages}
            currentSubscriptionStatus={currentSubscription?.status ?? null}
            initialSelectedPackageId={pendingCheckout?.draft?.subscription.package_id ?? pendingCheckoutPackageId ?? undefined}
            initialBillingCycle={(pendingCheckout?.draft?.billingCycle ?? (billingCycle === "yearly" ? "annual" : "monthly"))}
            customerContact={customerEmail}
            initialCheckoutState={pendingCheckout}
          />
        </div>
      )}

      {/* ═══ TAB: COMPARE PLANS ═══ */}
      {activeTab === "compare" && (
        <div className="space-y-6">
          {/* Billing cycle toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Billing:</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={cn("px-4 py-2 text-sm font-bold transition", billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground")}
                type="button"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={cn("px-4 py-2 text-sm font-bold transition border-l border-border", billingCycle === "yearly" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground")}
                type="button"
              >
                Yearly <span className="text-[10px] opacity-80">(Save 17%)</span>
              </button>
            </div>
          </div>

          {allPackages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
              <p className="text-sm font-semibold text-muted-foreground">No packages are available yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Contact your Super Admin to set up subscription packages.</p>
            </div>
          ) : (
            <>
              {/* Pricing Cards */}
              <div className="grid gap-5 lg:grid-cols-3">
                {allPackages.map((pkg) => {
                  const pkgPricing = (pkg as any)._pricing ?? [];
                  const monthlyPrice = isYearly
                    ? (pkgPricing.find((p: any) => p.billing_period === "annual")?.price ?? 0)
                    : (pkgPricing.find((p: any) => p.billing_period === "monthly")?.price ?? 0);
                  const isCurrent = currentPkg?.id === pkg.id;
                  const limits = (pkg as any)._limits ?? {};
                  const features = (pkg as any)._features ?? {};

                  return (
                    <div key={pkg.id} className={cn(
                      "relative rounded-xl border-2 bg-gradient-to-b from-background to-accent/5 p-6 transition-all hover:shadow-lg",
                      isCurrent ? "border-primary shadow-md" : "border-border",
                      (pkg as any).recommended ? "ring-2 ring-amber-400" : ""
                    )}>
                      {(pkg as any).recommended && !isCurrent && (
                        <span className="absolute -top-3 right-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm">Popular</span>
                      )}
                      {isCurrent && (
                        <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm">Current Plan</span>
                      )}
                      <p className="text-lg font-black">{pkg.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-3xl font-black">₹{Intl.NumberFormat("en-IN").format(Math.round(monthlyPrice / 100))}</span>
                        <span className="text-sm text-muted-foreground">/ {isYearly ? "year" : "month"}</span>
                      </div>

                      {/* Key limits */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Members</span>
                          <span className="font-bold">{limits.max_members === -1 ? "Unlimited" : limits.max_members ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Branches</span>
                          <span className="font-bold">{limits.max_branches === -1 ? "Unlimited" : limits.max_branches ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Staff</span>
                          <span className="font-bold">{limits.max_staff === -1 ? "Unlimited" : limits.max_staff ?? "—"}</span>
                        </div>
                      </div>

                      {/* Feature highlights */}
                      <div className="mt-4 space-y-1.5">
                        {FEATURE_CATEGORIES.map((cat) => {
                          const includedCount = cat.features.filter((f) => features[f.featureCode] === true || features[f.featureCode] === "true").length;
                          return (
                            <div key={cat.id} className="flex items-center gap-2 text-xs">
                              {includedCount > 0 ? (
                                <Check className="size-3.5 shrink-0 text-green-600" />
                              ) : (
                                <Minus className="size-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="text-muted-foreground">{cat.name}</span>
                              <span className="ml-auto font-semibold">{includedCount}/{cat.features.length}</span>
                            </div>
                          );
                        })}
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => handleComparePlanPay(pkg.id)}
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
                          type="button"
                        >
                          <CreditCard className="size-4" />
                          Continue to Pay
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB: BILLING ═══ */}
      {activeTab === "billing" && (
        <div className="space-y-5">
          <Card>
            <CardHeader><h2 className="text-2xl font-black">Invoices ({invoices.length})</h2></CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-6 text-center">
                  <ReceiptText className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">No invoices yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Invoices will appear after your first billing cycle.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Due</th><th className="px-3 py-2">Paid</th>
                    </tr></thead>
                    <tbody>
                      {invoices.slice(0, 10).map((inv: any) => (
                        <tr key={inv.id} className="border-b border-border hover:bg-accent/5">
                          <td className="px-3 py-2 text-xs font-semibold">{inv.invoice_number ?? inv.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-xs">{inv.billing_cycle ?? "—"}</td>
                          <td className="px-3 py-2 text-xs font-semibold">₹{Intl.NumberFormat("en-IN").format(Math.round((inv.total_amount ?? inv.subtotal_amount ?? 0) / 100))}</td>
                          <td className="px-3 py-2">{(() => {
                            if (inv.paid_at) return <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200">Paid</span>;
                            if (inv.status === "failed" || inv.dunning_status === "payment_failed") return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">Failed</span>;
                            if (inv.dunning_status === "overdue") return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">Overdue</span>;
                            return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">{inv.status ?? "Pending"}</span>;
                          })()}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground" suppressHydrationWarning>{inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-IN") : "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground" suppressHydrationWarning>{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-IN") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="text-2xl font-black">Subscription Settings</h2></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border bg-background p-4">
                <div><p className="text-sm font-bold">Auto-Renewal</p><p className="text-xs text-muted-foreground">Automatically renew each billing cycle</p></div>
                <button className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${!canManageSubscription || isCancelled || hasPendingCancel || autoRenew === null ? "cursor-not-allowed bg-muted text-muted-foreground" : autoRenew ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} disabled={autoRenewPending || !canManageSubscription || isCancelled || hasPendingCancel || autoRenew === null} onClick={handleToggleAutoRenew} type="button">
                  {autoRenewPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {!canManageSubscription || autoRenew === null ? "Unavailable" : isCancelled ? "Unavailable" : hasPendingCancel ? "Scheduled End" : autoRenew ? "Enabled" : "Disabled"}
                </button>
              </div>
              {hasPendingCancel ? (
                <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 p-4">
                  <div>
                    <p className="text-sm font-bold text-blue-800">Cancellation Scheduled</p>
                    <p className="text-xs text-blue-600">Ends {scheduledEndDate?.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                  <form action={reactivateAction}>
                    <button className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition-all hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={reactivatePending} type="submit">
                      {reactivatePending ? <Loader2 className="size-4 animate-spin" /> : null}
                      Reactivate
                    </button>
                  </form>
                </div>
              ) : canManageSubscription ? (
                <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4">
                  <div><p className="text-sm font-bold text-red-800">Cancel Subscription</p><p className="text-xs text-red-600">You will keep access until the end of the billing period</p></div>
                  <button className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={isCancelled} onClick={() => setShowCancel(true)} type="button">{isCancelled ? "Cancelled" : "Cancel"}</button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
                  <div>
                    <p className="text-sm font-bold">No active plan</p>
                    <p className="text-xs text-muted-foreground">Select a package to enable billing controls.</p>
                  </div>
                  <button className="rounded-md border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={() => setActiveTab("compare")} type="button">Choose Plan</button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ TAB: TIMELINE — Transaction History ═══ */}
      {activeTab === "timeline" && (
        <div className="space-y-5">
          <Card>
            <CardHeader><h2 className="text-2xl font-black">Transaction History</h2></CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-6 text-center">
                  <CreditCard className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">No transactions yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Transactions will appear here after your first payment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-3 py-2">Transaction</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Details</th>
                    </tr></thead>
                    <tbody>
                      {payments.slice(0, 20).map((pmt: any) => (
                        <tr key={pmt.id} className="border-b border-border hover:bg-accent/5">
                          <td className="px-3 py-2 text-xs font-semibold font-mono">{pmt.payment_number ?? pmt.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-xs font-semibold">₹{Intl.NumberFormat("en-IN").format(Math.round((pmt.amount ?? 0) / 100))}</td>
                          <td className="px-3 py-2">{(() => {
                            switch (pmt.status) {
                              case "paid": return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200"><CheckCircle2 className="size-3" /> Paid</span>;
                              case "failed": return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200"><XCircle className="size-3" /> Failed</span>;
                              case "cancelled": return <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-700 border border-gray-200"><XCircle className="size-3" /> Cancelled</span>;
                              case "refunded":
                              case "partially_refunded": return <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200"><RefreshCw className="size-3" /> Refunded</span>;
                              case "signature_acknowledged": return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200"><Clock className="size-3" /> Verifying</span>;
                              case "processing": return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200"><Loader2 className="size-3 animate-spin" /> Processing</span>;
                              case "created": return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200"><Minus className="size-3" /> Pending</span>;
                              default: return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">{pmt.status ?? "Unknown"}</span>;
                            }
                          })()}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground" suppressHydrationWarning>{pmt.paid_at ? new Date(pmt.paid_at).toLocaleDateString("en-IN") : pmt.created_at ? new Date(pmt.created_at).toLocaleDateString("en-IN") : "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{pmt.failure_reason ?? pmt.provider_order_id ? `Order: ${String(pmt.provider_order_id).slice(0, 12)}…` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="text-2xl font-black">Subscription Timeline</h2></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentSubscription ? (
                  <div className="flex items-start gap-4">
                    <div className={cn("size-3 rounded-full mt-1", currentSubscription.status === "active" ? "bg-green-500" : currentSubscription.status === "trial" ? "bg-blue-500" : currentSubscription.status === "cancelled" ? "bg-red-500" : "bg-amber-500")} />
                    <div className="pb-6">
                      <p className="text-sm font-bold">Current Subscription</p>
                      <p className="text-xs text-muted-foreground">Plan: {currentPkg?.name ?? planContext.packageName}</p>
                      <p className="text-xs text-muted-foreground">Status: {currentSubscription.status}</p>
                      <p className="text-xs text-muted-foreground">Started: {currentSubscription.started_at ? new Date(currentSubscription.started_at).toLocaleDateString("en-IN") : "—"}</p>
                      {currentSubscription.expires_at ? <p className="text-xs text-muted-foreground">Expires: {new Date(currentSubscription.expires_at).toLocaleDateString("en-IN")}</p> : null}
                      {currentSubscription.cancelled_at ? <p className="text-xs text-red-600">Cancelled: {new Date(currentSubscription.cancelled_at).toLocaleDateString("en-IN")}</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="size-3 rounded-full mt-1 bg-gray-300" />
                    <div className="pb-6">
                      <p className="text-sm font-bold text-muted-foreground">No Active Subscription</p>
                      <p className="text-xs text-muted-foreground">Subscribe to a plan to get started.</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="size-3 rounded-full border-2 border-dashed border-border mt-1" />
                  <div><p className="text-sm font-bold text-muted-foreground">Present Day</p><p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN")}</p></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2"><AlertTriangle className="size-5 text-red-600" /></div>
              <div><h3 className="text-lg font-black">Cancel Subscription</h3><p className="text-sm text-muted-foreground">Your data will be retained for 30 days.</p></div>
            </div>
            <form action={cancelAction} className="space-y-4">
              {cancelState.message ? (
                <div className={`rounded-md border p-3 text-sm font-semibold ${cancelState.status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>{cancelState.message}</div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-bold">Reason <span className="text-red-500">*</span></label>
                <textarea className={`${selectClass} min-h-[80px]`} minLength={10} name="reason" required placeholder="Tell us why (minimum 10 characters)..." rows={3} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Type <kbd className="rounded border border-border bg-background px-2 py-0.5 text-xs font-mono">CANCEL</kbd> to confirm <span className="text-red-500">*</span></label>
                <input autoComplete="off" className={selectClass} name="confirmation" pattern="CANCEL" required placeholder="Type CANCEL here" />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <input className="mt-0.5 size-4 shrink-0 accent-red-600" name="termsAccepted" required type="checkbox" value="true" />
                <span>
                  I understand that my plan stays active until the end of the billing period, auto-renewal stops, and no refund is issued for the current paid period. I can reactivate at any time before the end date to keep my plan.
                </span>
              </label>
              <div className="flex justify-end gap-3 pt-4">
                <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={() => setShowCancel(false)} type="button">Keep Subscription</button>
                <button className="inline-flex items-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50" disabled={cancelPending} type="submit">
                  {cancelPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
