"use client";

import { useCallback, useMemo, useState } from "react";
import { useActionState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, CreditCard, LineChart, Loader2, Minus, Plus, ReceiptText, RefreshCw, XCircle } from "lucide-react";
import { LineChart as RechartsLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";
import { requestPlanChangeAction, toggleAutoRenewAction, cancelSubscriptionAction } from "@/features/organization-owner/actions/plan-actions";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import type { PackageWithMeta, SubscriptionWithPackage, UsageHistoryPoint } from "@/features/organization-owner/actions/plan-data-actions";

type EnterprisePlanManagementProps = {
  organizationId: string;
  planContext: OrgPlanContext;
  allPackages: PackageWithMeta[];
  currentSubscription: SubscriptionWithPackage | null;
  usageHistory: UsageHistoryPoint[];
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function EnterprisePlanManagement({ organizationId, planContext, allPackages, currentSubscription, usageHistory }: EnterprisePlanManagementProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "compare" | "billing" | "addons" | "timeline">("overview");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showCancel, setShowCancel] = useState(false);
  const [showUpgradeForm, setShowUpgradeForm] = useState<string | null>(null);
  const [planChangeState, planChangeAction, planChangePending] = useActionState(requestPlanChangeAction, initialAuthActionState);
  const [autoRenewState, autoRenewAction, autoRenewPending] = useActionState(toggleAutoRenewAction, initialAuthActionState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelSubscriptionAction, initialAuthActionState);


  const packageName = planContext.packageName?.toLowerCase() ?? "unknown";
  const isActive = planContext.status === "active";
  const isTrialing = planContext.isTrialing;
  const isSuspended = planContext.isSuspended;
  const autoRenew = currentSubscription ? (currentSubscription as unknown as { auto_renew: boolean }).auto_renew : true;

  // Find the current package from the packages list
  const currentPkg = currentSubscription
    ? allPackages.find((p) => p.id === currentSubscription.package_id) ?? null
    : null;

  // Trial countdown
  const trialDaysRemaining = useMemo(() => {
    if (!planContext.trialEndsAt) return null;
    return Math.max(0, Math.ceil((planContext.trialEndsAt.getTime() - Date.now()) / 86400000));
  }, [planContext.trialEndsAt]);

  // Build feature list from package columns
  const featureLabels: Record<string, string> = {
    qr_attendance_enabled: "QR Attendance",
    biometric_attendance_enabled: "Biometric Attendance",
    rfid_attendance_enabled: "RFID Attendance",
    class_scheduling_enabled: "Class Scheduling",
    trainer_assignment_enabled: "Trainer Assignment",
    razorpay_enabled: "Online Payments",
    communications_enabled: "Member Communications",
    ai_enabled: "AI Recommendations",
    advanced_reports_enabled: "Advanced Reports & BI",
    custom_domain_enabled: "Custom Domain",
    api_access_enabled: "API Access",
    notifications_enabled: "Notifications",
    white_label_enabled: "White Label",
  };

  const allFeatureKeys = Object.keys(featureLabels);

  // Current package's enabled features
  const currentFeatures = useMemo(() => {
    if (!currentPkg) return {} as Record<string, boolean>;
    const features: Record<string, boolean> = {};
    for (const key of allFeatureKeys) {
      features[key] = !!(currentPkg as unknown as Record<string, unknown>)[key];
    }
    return features;
  }, [currentPkg]);

  const handleUpgradeRequest = useCallback((targetPlanName: string) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("targetPlan", targetPlanName);
    fd.set("billingCycle", billingCycle);
    planChangeAction(fd);
  }, [billingCycle, planChangeAction]);

  const handleToggleAutoRenew = useCallback(() => {
    const fd = new FormData();
    fd.set("enabled", String(!autoRenew));
    autoRenewAction(fd);
  }, [autoRenew, autoRenewAction]);

  // Available add-ons (configured by Super Admin in the future)
  const availableAddons: Array<{ name: string; description: string; price: number; category: string }> = [];

  // ── Render ──
  return (
    <div className="space-y-8">
      <ToastContainer />

      {/* ═══ TRIAL BANNER ═══ */}
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

      {/* ═══ SUSPENDED BANNER ═══ */}
      {isSuspended ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
            <div><p className="text-sm font-bold text-red-800">Subscription Suspended</p><p className="text-sm text-red-700">Features are locked. Contact support to reactivate.</p></div>
          </div>
        </div>
      ) : null}

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["overview", "compare", "billing", "addons", "timeline"] as const).map((tab) => (
          <button key={tab} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab} type="button">
            {tab === "overview" ? "Overview" : tab === "compare" ? "Compare Plans" : tab === "billing" ? "Billing" : tab === "addons" ? "Add-Ons" : "Timeline"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Current Plan Card */}
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
                  </div>
                  {currentPkg ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${(currentPkg as unknown as { recommended: boolean }).recommended ? "bg-amber-100 text-amber-700" : "bg-surface-muted text-muted-foreground"}`}>
                      {(currentPkg as unknown as { recommended: boolean }).recommended ? "Recommended" : "Current"}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</p><Badge className="mt-1" variant={isActive ? "success" : isTrialing ? "info" : "error"}>{planContext.status}</Badge></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Billing</p><p className="mt-1 text-sm font-bold capitalize">{billingCycle}</p></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Auto-Renew</p>
                    <button className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${autoRenew ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} disabled={autoRenewPending} onClick={handleToggleAutoRenew} type="button">
                      {autoRenewPending ? <Loader2 className="size-3 animate-spin" /> : null}
                      {autoRenew ? "Enabled" : "Disabled"} <RefreshCw className="size-3" />
                    </button>
                  </div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Renewal</p><p className="mt-1 text-sm font-bold">{planContext.expiresAt ? planContext.expiresAt.toLocaleDateString("en-IN") : "No expiry"}</p></div>
                </div>
                <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" onClick={() => setActiveTab("compare")} type="button">Compare & Upgrade</button>
                <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-all hover:bg-red-100" onClick={() => setShowCancel(true)} type="button">Cancel Subscription</button>
              </CardContent>
            </Card>

            {/* Usage Trend */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><LineChart className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Usage</h2></div>
              </CardHeader>
              <CardContent>
                {usageHistory.length < 2 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Not enough usage data yet.</p>
                ) : (
                  <div className="h-40 w-full">
                    <ResponsiveContainer height="100%" width="100%">
                      <RechartsLine data={usageHistory}>
                        <Tooltip />
                        <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} type="monotone" name="Members" />
                        <Line dataKey="branches" stroke="#0891b2" strokeWidth={2} dot={{ r: 2 }} type="monotone" name="Branches" />
                      </RechartsLine>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Plan Limit</p><p className="text-sm font-bold">{currentPkg ? `${currentPkg.max_members} members` : "—"}</p></div>
                  <div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Branches</p><p className="text-sm font-bold">{currentPkg ? `${currentPkg.max_branches} max` : "—"}</p></div>
                  <div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Features</p><p className="text-sm font-bold">{currentPkg ? `${Object.entries(currentFeatures).filter(([, v]) => v).length}/${allFeatureKeys.length}` : "—"}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Current Add-Ons */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Plus className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Add-Ons</h2></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Enhance your plan with additional features.</p>
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-4 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">No add-ons yet</p>
                  <p className="text-xs text-muted-foreground">Browse the marketplace to enhance your plan.</p>
                </div>
                <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-bold transition-all hover:border-border-strong" onClick={() => setActiveTab("addons")} type="button"><Plus className="size-4" /> Browse Add-Ons</button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* ═══ TAB: COMPARE PLANS ═══ */}
      {activeTab === "compare" ? (
        <div className="space-y-6">
          {allPackages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
              <p className="text-sm font-semibold text-muted-foreground">No packages are available yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Contact your Super Admin to set up subscription packages.</p>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-2xl font-black">Compare Plans</h2><p className="mt-1 text-sm text-muted-foreground">Packages configured by your platform administrator</p></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead><tr className="border-b border-border">
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Feature</th>
                        {allPackages.map((pkg) => (
                          <th key={pkg.id} className={`px-4 py-3 ${currentPkg?.id === pkg.id ? "bg-accent/5" : ""}`}>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-black">{pkg.name}</span>
                              {(pkg as unknown as { recommended: boolean }).recommended ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Recommended</span> : null}
                              {currentPkg?.id === pkg.id ? <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">Current</span> : null}
                            </div>
                          </th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-border">
                        <tr><td colSpan={allPackages.length + 1} className="bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Limits</td></tr>
                        <tr className="hover:bg-surface-muted/50">
                          <td className="px-4 py-3 font-semibold">Members</td>
                          {allPackages.map((pkg) => (
                            <td key={pkg.id} className={`px-4 py-3 text-center font-semibold ${currentPkg?.id === pkg.id ? "bg-accent/5" : ""}`}>
                              {pkg.max_members === -1 ? "Unlimited" : String(pkg.max_members)}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-surface-muted/50">
                          <td className="px-4 py-3 font-semibold">Branches</td>
                          {allPackages.map((pkg) => (
                            <td key={pkg.id} className={`px-4 py-3 text-center font-semibold ${currentPkg?.id === pkg.id ? "bg-accent/5" : ""}`}>
                              {pkg.max_branches === -1 ? "Unlimited" : String(pkg.max_branches)}
                            </td>
                          ))}
                        </tr>
                        <tr><td colSpan={allPackages.length + 1} className="bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Features</td></tr>
                        {allFeatureKeys.map((key) => (
                          <tr key={key} className="hover:bg-surface-muted/50">
                            <td className="px-4 py-3 font-semibold">{featureLabels[key]}</td>
                            {allPackages.map((pkg) => {
                              const enabled = !!(pkg as unknown as Record<string, unknown>)[key];
                              return (
                                <td key={pkg.id} className={`px-4 py-3 text-center ${currentPkg?.id === pkg.id ? "bg-accent/5" : ""}`}>
                                  {enabled ? <Check className="mx-auto size-4 text-green-600" /> : <Minus className="mx-auto size-4 text-muted-foreground" />}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Plan change request forms */}
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-black">Request Plan Change</h3>
                    <p className="text-sm text-muted-foreground">Select a target plan below. An admin will review your request.</p>
                    {allPackages.filter((p) => p.id !== currentPkg?.id).map((targetPkg) => (
                      <div key={targetPkg.id} className="rounded-lg border border-border bg-surface-muted p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">{targetPkg.name}</p>
                            <p className="text-xs text-muted-foreground">{targetPkg.max_members} members · {targetPkg.max_branches} branches</p>
                          </div>
                          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm" onClick={() => setShowUpgradeForm(showUpgradeForm === targetPkg.id ? null : targetPkg.id)} type="button">
                            {showUpgradeForm === targetPkg.id ? "Cancel" : "Request Upgrade"}
                          </button>
                        </div>
                        {showUpgradeForm === targetPkg.id ? (
                          <form onSubmit={handleUpgradeRequest(targetPkg.name)} className="mt-4 space-y-3">
                            <input name="targetPlan" type="hidden" value={targetPkg.name} />
                            <input name="billingCycle" type="hidden" value={billingCycle} />
                            <div className="space-y-2">
                              <label className="text-sm font-bold">Reason for change <span className="text-red-500">*</span></label>
                              <textarea className={`${selectClass} min-h-[80px]`} name="reason" required placeholder="Explain why you need to upgrade/downgrade..." rows={3} />
                            </div>
                            {planChangeState.message ? (
                              <div className={`rounded-md border p-3 text-sm font-semibold ${planChangeState.status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`} role="alert">{planChangeState.message}</div>
                            ) : null}
                            <div className="flex justify-end">
                              <button className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50" disabled={planChangePending} type="submit">
                                {planChangePending ? <Loader2 className="size-4 animate-spin" /> : null}
                                Submit Request
                              </button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Current plan features detail */}
              <Card>
                <CardHeader><h2 className="text-2xl font-black">Features Included</h2><p className="text-sm text-muted-foreground">Features included in {currentPkg?.name ?? planContext.packageName}</p></CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {allFeatureKeys.map((key) => {
                      const enabled = !!currentFeatures[key];
                      return (
                        <div key={key} className={`rounded-md border p-4 transition-all ${enabled ? "border-border bg-surface" : "border-dashed border-border bg-surface-muted"}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div><p className={`text-sm font-bold ${enabled ? "" : "text-muted-foreground"}`}>{featureLabels[key]}</p></div>
                            {enabled ? (
                              <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700"><CheckCircle2 className="size-3.5" /> Included</span>
                            ) : (
                              <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-muted-foreground"><XCircle className="size-3.5" /> Locked</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      ) : null}

      {/* ═══ TAB: BILLING ═══ */}
      {activeTab === "billing" ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><h2 className="text-2xl font-black">Invoices</h2></CardHeader>
              <CardContent>
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-6 text-center">
                  <ReceiptText className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">No invoices yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Invoices will appear after your first billing cycle.</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><h2 className="text-2xl font-black">Payment Method</h2><p className="text-sm text-muted-foreground">Managed via Razorpay</p></CardHeader>
              <CardContent>
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-6 text-center">
                  <CreditCard className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">No payment method configured</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><h2 className="text-2xl font-black">Subscription Settings</h2></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border bg-background p-4">
                <div><p className="text-sm font-bold">Auto-Renewal</p><p className="text-xs text-muted-foreground">Automatically renew each billing cycle</p></div>
                <button className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${autoRenew ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} disabled={autoRenewPending} onClick={handleToggleAutoRenew} type="button">
                  {autoRenewPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {autoRenew ? "Enabled" : "Disabled"}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4">
                <div><p className="text-sm font-bold text-red-800">Cancel Subscription</p><p className="text-xs text-red-600">Data retained for 30 days after cancellation</p></div>
                <button className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition-all hover:bg-red-100" onClick={() => setShowCancel(true)} type="button">Cancel</button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: ADD-ONS ═══ */}
      {activeTab === "addons" ? (
        <Card>
          <CardHeader><h2 className="text-2xl font-black">Add-On Marketplace</h2><p className="text-sm text-muted-foreground">Additional features to enhance your plan</p></CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
              <Plus className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">Add-ons coming soon</p>
              <p className="mt-1 text-xs text-muted-foreground">Super Admin will be able to configure available add-ons for your organization.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ═══ TAB: TIMELINE ═══ */}
      {activeTab === "timeline" ? (
        <Card>
          <CardHeader><h2 className="text-2xl font-black">Subscription Timeline</h2></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="size-3 rounded-full bg-green-500" />
                <div className="pb-6">
                  <p className="text-sm font-bold">Current Subscription</p>
                  <p className="text-xs text-muted-foreground">Plan: {currentPkg?.name ?? planContext.packageName}</p>
                  <p className="text-xs text-muted-foreground">
                    Started: {currentSubscription?.started_at ? new Date(currentSubscription.started_at).toLocaleDateString("en-IN") : "—"}
                  </p>
                </div>
              </div>
              {planContext.expiresAt ? (
                <div className="flex items-start gap-4">
                  <div className="size-3 rounded-full bg-amber-500" />
                  <div><p className="text-sm font-bold">Next Renewal</p><p className="text-xs text-muted-foreground">{planContext.expiresAt.toLocaleDateString("en-IN")}</p></div>
                </div>
              ) : null}
              <div className="flex items-start gap-4">
                <div className="size-3 rounded-full border-2 border-dashed border-border" />
                <div><p className="text-sm font-bold text-muted-foreground">Present Day</p><p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN")}</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ═══ CANCEL FLOW ═══ */}
      {showCancel ? (
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
                <textarea className={`${selectClass} min-h-[80px]`} name="reason" required placeholder="Tell us why..." rows={3} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Type <kbd className="rounded border border-border bg-background px-2 py-0.5 text-xs font-mono">CANCEL</kbd> to confirm <span className="text-red-500">*</span></label>
                <input className={selectClass} name="confirmation" required placeholder="Type CANCEL here" />
              </div>
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
      ) : null}
    </div>
  );
}
