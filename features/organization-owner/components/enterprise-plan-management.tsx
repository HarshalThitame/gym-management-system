"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCircle2, ChevronDown, ChevronRight, Clock, CreditCard, Download, Info, LineChart as LineChartIcon, Loader2, Minus, Plus, ReceiptText, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { requestPlanChangeAction, toggleAutoRenewAction, cancelSubscriptionAction, assignAddonAction, removeAddonAction as removeAddonServerAction } from "@/features/organization-owner/actions/plan-actions";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import type { PlanServerData } from "@/features/organization-owner/services/plan-data-service";

type EnterprisePlanManagementProps = {
  organizationId: string;
  planContext: OrgPlanContext;
  serverData: PlanServerData;
};

const featureLabels: Record<string, string> = {
  qrAttendanceEnabled: "QR Attendance",
  biometricAttendanceEnabled: "Biometric Attendance",
  rfidAttendanceEnabled: "RFID Attendance",
  classSchedulingEnabled: "Class Scheduling",
  trainerAssignmentEnabled: "Trainer Assignment",
  razorpayEnabled: "Online Payments",
  communicationsEnabled: "Member Communications",
  aiEnabled: "AI Recommendations",
  advancedReportsEnabled: "Advanced Reports & BI",
  customDomainEnabled: "Custom Domain",
  apiAccessEnabled: "API Access",
};

const featureDescriptions: Record<string, string> = {
  qrAttendanceEnabled: "Members check in via QR code scanning", biometricAttendanceEnabled: "Fingerprint or face recognition check-in",
  rfidAttendanceEnabled: "RFID card/NFC tag based access control", classSchedulingEnabled: "Create, manage, and book class sessions",
  trainerAssignmentEnabled: "Assign trainers to members and track PT sessions", razorpayEnabled: "Accept online payments via Razorpay",
  communicationsEnabled: "Send email, SMS, and WhatsApp campaigns", aiEnabled: "AI-powered fitness recommendations",
  advancedReportsEnabled: "Custom report builder with BI dashboards", customDomainEnabled: "White-label custom domain for your gym portal",
  apiAccessEnabled: "REST API access for third-party integrations",
};

const planRecommendations: Record<string, { badge: string; color: string }> = {
  lite: { badge: "Getting Started", color: "border-slate-200 bg-slate-50 text-slate-700" },
  standard: { badge: "Most Popular", color: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  premium: { badge: "Best Value", color: "border-amber-200 bg-amber-50 text-amber-800" },
  enterprise: { badge: "Maximum Power", color: "border-purple-200 bg-purple-50 text-purple-800" },
};

const planFeatures: Record<string, Partial<Record<string, boolean | number>>> = {
  lite: { maxMembers: 100, maxBranches: 1, qrAttendanceEnabled: true, trainerAssignmentEnabled: true },
  standard: { maxMembers: 500, maxBranches: 3, qrAttendanceEnabled: true, trainerAssignmentEnabled: true, classSchedulingEnabled: true, razorpayEnabled: true, communicationsEnabled: true },
  premium: { maxMembers: 2000, maxBranches: 10, qrAttendanceEnabled: true, biometricAttendanceEnabled: true, trainerAssignmentEnabled: true, classSchedulingEnabled: true, razorpayEnabled: true, communicationsEnabled: true, aiEnabled: true, advancedReportsEnabled: true, customDomainEnabled: true },
  enterprise: { maxMembers: -1, maxBranches: -1, qrAttendanceEnabled: true, biometricAttendanceEnabled: true, rfidAttendanceEnabled: true, classSchedulingEnabled: true, trainerAssignmentEnabled: true, razorpayEnabled: true, communicationsEnabled: true, aiEnabled: true, advancedReportsEnabled: true, customDomainEnabled: true, apiAccessEnabled: true },
};

const planPrices: Record<string, { monthly: number; yearly: number }> = {
  lite: { monthly: 2999, yearly: 29990 },
  standard: { monthly: 7999, yearly: 79990 },
  premium: { monthly: 19999, yearly: 199990 },
  enterprise: { monthly: 49999, yearly: 499990 },
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function EnterprisePlanManagement({ organizationId, planContext, serverData }: EnterprisePlanManagementProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "compare" | "billing" | "addons" | "timeline">("overview");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showCancel, setShowCancel] = useState(false);
  const [showUpgradeForm, setShowUpgradeForm] = useState<string | null>(null);
  const [planChangeState, planChangeAction, planChangePending] = useActionState(requestPlanChangeAction, initialAuthActionState);
  const [autoRenewState, autoRenewAction, autoRenewPending] = useActionState(toggleAutoRenewAction, initialAuthActionState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelSubscriptionAction, initialAuthActionState);
  const [addonState, addonAction] = useActionState(assignAddonAction, initialAuthActionState);
  const [, removeAddonAction] = useActionState(removeAddonServerAction, initialAuthActionState);

  const packageName = planContext.packageName?.toLowerCase() ?? "unknown";
  const isActive = planContext.status === "active";
  const isTrialing = planContext.isTrialing;
  const isSuspended = planContext.isSuspended;
  const rec = planRecommendations[packageName as keyof typeof planRecommendations];
  const currentFeatures = planContext.features;
  const planKeys = Object.keys(planFeatures) as Array<keyof typeof planFeatures>;

  // Trial countdown
  const trialDaysRemaining = useMemo(() => {
    if (!planContext.trialEndsAt) return null;
    return Math.max(0, Math.ceil((planContext.trialEndsAt.getTime() - Date.now()) / 86400000));
  }, [planContext.trialEndsAt]);

  const handleUpgradeRequest = useCallback((targetPlan: string) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("targetPlan", targetPlan);
    fd.set("billingCycle", billingCycle);
    planChangeAction(fd);
  }, [billingCycle, planChangeAction]);

  const handleToggleAutoRenew = useCallback(() => {
    const fd = new FormData();
    fd.set("enabled", String(!serverData.autoRenew));
    autoRenewAction(fd);
  }, [serverData.autoRenew, autoRenewAction]);

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
                <p className={`text-sm font-bold ${trialDaysRemaining <= 3 ? "text-red-800" : "text-cyan-900"}`}>Trial ends in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}</p>
                <p className={`text-sm ${trialDaysRemaining <= 3 ? "text-red-700" : "text-cyan-700"}`}>{trialDaysRemaining <= 3 ? "Choose a plan to avoid service interruption." : `Explore plans to find the best fit.`}</p>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" onClick={() => setActiveTab("compare")} type="button">View Plans & Upgrade</button>
          </div>
          {planContext.trialEndsAt ? (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className={`h-full rounded-full transition-all duration-700 ${trialDaysRemaining <= 3 ? "bg-red-500" : "bg-cyan-500"}`}
                style={{ width: `${Math.max(0, Math.min(100, ((planContext.trialEndsAt.getTime() - Date.now()) / (planContext.trialEndsAt.getTime() - new Date(planContext.trialEndsAt.getTime() - 30 * 86400000).getTime())) * 100))}%` }} />
            </div>
          ) : null}
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
            {tab === "overview" ? "Overview" : tab === "compare" ? "Compare Plans" : tab === "billing" ? "Billing & Payments" : tab === "addons" ? "Add-Ons" : "Timeline"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><CreditCard className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Current Plan</h2></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Package</p><p className="mt-1 text-3xl font-black">{planContext.packageName}</p></div>
                  {rec ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${rec.color}`}>{rec.badge}</span> : null}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</p><Badge className="mt-1" variant={isActive ? "success" : isTrialing ? "info" : "error"}>{planContext.status}</Badge></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Billing</p><p className="mt-1 text-sm font-bold capitalize">{billingCycle}</p></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Auto-Renew</p>
                    <button className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${serverData.autoRenew ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} disabled={autoRenewPending} onClick={handleToggleAutoRenew} type="button">
                      {autoRenewPending ? <Loader2 className="size-3 animate-spin" /> : null}
                      {serverData.autoRenew ? "Enabled" : "Disabled"} <RefreshCw className="size-3" />
                    </button>
                  </div>
                  <div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Renewal</p><p className="mt-1 text-sm font-bold">{planContext.expiresAt ? planContext.expiresAt.toLocaleDateString("en-IN") : "No expiry"}</p></div>
                </div>
                <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" onClick={() => setActiveTab("compare")} type="button">Compare & Upgrade</button>
                <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-all hover:bg-red-100" onClick={() => setShowCancel(true)} type="button">Cancel Subscription</button>
              </CardContent>
            </Card>

            {/* Usage + Trend */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><LineChartIcon className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Usage Trend</h2></div>
              </CardHeader>
              <CardContent>
                {serverData.usageHistory.length < 2 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Not enough usage data yet.</p>
                ) : (
                  <div className="h-40 w-full">
                    <ResponsiveContainer height="100%" width="100%">
                      <LineChart data={serverData.usageHistory}>
                        <Tooltip />
                        <Line dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} type="monotone" name="Members" />
                        <Line dataKey="branches" stroke="#0891b2" strokeWidth={2} dot={{ r: 2 }} type="monotone" name="Branches" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {(() => { const last = serverData.usageHistory[serverData.usageHistory.length - 1]; return last ? (
                    <><div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Members</p><p className="text-sm font-bold">{last.members}</p></div>
                    <div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Branches</p><p className="text-sm font-bold">{last.branches}</p></div>
                    <div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Storage</p><p className="text-sm font-bold">{`${Math.round(last.storageMb / 1024)} GB`}</p></div></>
                  ) : (
                    <><div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Members</p><p className="text-sm font-bold">0</p></div>
                    <div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Branches</p><p className="text-sm font-bold">0</p></div>
                    <div className="rounded-md bg-surface-muted p-2"><p className="text-xs text-muted-foreground">Storage</p><p className="text-sm font-bold">0 GB</p></div></>
                  ); })()}
                </div>
              </CardContent>
            </Card>

            {/* Current Add-Ons */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Plus className="size-5 text-muted-foreground" /><h2 className="text-xl font-black">Add-Ons</h2></div>
              </CardHeader>
              <CardContent className="space-y-3">
                {serverData.currentAddons.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-surface-muted p-4 text-center">
                    <p className="text-sm font-semibold text-muted-foreground">No add-ons yet</p>
                    <p className="text-xs text-muted-foreground">Browse the marketplace to enhance your plan.</p>
                  </div>
                ) : serverData.currentAddons.map((a) => (
                  <div key={a.name} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <div><p className="text-sm font-bold">{a.name}</p><p className="text-xs text-muted-foreground">Added {new Date(a.assignedAt).toLocaleDateString("en-IN")}</p></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black">₹{a.price.toLocaleString("en-IN")}/mo</span>
                      <button className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={async () => { const fd = new FormData(); fd.set("addonName", a.name); removeAddonAction(fd); showToast(`Removal requested for ${a.name}`, "success"); }} type="button" aria-label={`Remove ${a.name}`}><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
                <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-bold transition-all hover:border-border-strong" onClick={() => setActiveTab("addons")} type="button"><Plus className="size-4" /> Browse Add-Ons</button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* ═══ TAB: COMPARE PLANS ═══ */}
      {activeTab === "compare" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><h2 className="text-2xl font-black">Compare Plans</h2><p className="mt-1 text-sm text-muted-foreground">Find the perfect plan for your organization</p></div>
                <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
                  <button className={`rounded-md px-4 py-2 text-sm font-bold transition ${billingCycle === "monthly" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setBillingCycle("monthly")} type="button">Monthly</button>
                  <button className={`rounded-md px-4 py-2 text-sm font-bold transition ${billingCycle === "yearly" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setBillingCycle("yearly")} type="button">Yearly <span className="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">Save 17%</span></button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Feature</th>
                    {planKeys.map((key) => (
                      <th key={key} className={`px-4 py-3 ${packageName === key ? "bg-accent/5" : ""}`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-black">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                          <span className="text-lg font-black">₹{((billingCycle === "monthly" ? planPrices[key as keyof typeof planPrices]?.monthly : planPrices[key as keyof typeof planPrices]?.yearly) ?? 0).toLocaleString("en-IN")}</span>
                          <span className="text-[10px] text-muted-foreground">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                          {key === packageName ? <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">Current</span> : null}
                        </div>
                      </th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    <tr><td colSpan={5} className="bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Limits</td></tr>
                    {["maxMembers", "maxBranches"].map((key) => (
                      <tr key={key} className="hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-semibold">{key === "maxMembers" ? "Members" : "Branches"}</td>
                        {planKeys.map((pKey) => {
                          const val = planFeatures[pKey]?.[key as keyof (typeof planFeatures)[typeof pKey]];
                          return <td key={pKey} className={`px-4 py-3 text-center font-semibold ${packageName === pKey ? "bg-accent/5" : ""}`}>{val === -1 ? "Unlimited" : val != null ? String(val) : "—"}</td>;
                        })}
                      </tr>
                    ))}
                    <tr><td colSpan={5} className="bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Features</td></tr>
                    {Object.entries(featureLabels).map(([key, label]) => (
                      <tr key={key} className="hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-semibold"><span title={featureDescriptions[key] ?? ""}>{label}</span></td>
                        {planKeys.map((pKey) => {
                          const enabled = !!(planFeatures[pKey] as Record<string, unknown>)[key];
                          return <td key={pKey} className={`px-4 py-3 text-center ${packageName === pKey ? "bg-accent/5" : ""}`}>{enabled ? <Check className="mx-auto size-4 text-green-600" /> : <Minus className="mx-auto size-4 text-muted-foreground" />}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Upgrade request section */}
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-black">Request Plan Change</h3>
                <p className="text-sm text-muted-foreground">Select a target plan and provide a reason. An admin will review your request.</p>
                {planKeys.filter((k) => k !== packageName).map((targetPlan) => (
                  <div key={targetPlan} className="rounded-lg border border-border bg-surface-muted p-4">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-bold capitalize">{targetPlan} — ₹{((billingCycle === "monthly" ? planPrices[targetPlan as keyof typeof planPrices]?.monthly : planPrices[targetPlan as keyof typeof planPrices]?.yearly) ?? 0).toLocaleString("en-IN")}/{billingCycle === "monthly" ? "mo" : "yr"}</p></div>
                      <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm" onClick={() => setShowUpgradeForm(showUpgradeForm === targetPlan ? null : targetPlan)} type="button">
                        {showUpgradeForm === targetPlan ? "Cancel" : "Request Upgrade"}
                      </button>
                    </div>
                    {showUpgradeForm === targetPlan ? (
                      <form onSubmit={handleUpgradeRequest(targetPlan)} className="mt-4 space-y-3">
                        <input name="targetPlan" type="hidden" value={targetPlan} />
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

          {/* Features detail */}
          <Card>
            <CardHeader><h2 className="text-2xl font-black">Plan Features</h2><p className="text-sm text-muted-foreground">Detailed features included in {planContext.packageName}</p></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(featureLabels).map(([key, label]) => {
                  const enabled = !!(currentFeatures as unknown as Record<string, boolean | number>)[key as keyof typeof currentFeatures];
                  return (
                    <div key={key} className={`rounded-md border p-4 transition-all ${enabled ? "border-border bg-surface" : "border-dashed border-border bg-surface-muted"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div><p className={`text-sm font-bold ${enabled ? "" : "text-muted-foreground"}`}>{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{featureDescriptions[key] ?? ""}</p></div>
                        {enabled ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700"><CheckCircle2 className="size-3.5" /> Included</span> : <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-muted-foreground"><XCircle className="size-3.5" /> Locked</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: BILLING ═══ */}
      {activeTab === "billing" ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><h2 className="text-2xl font-black">Invoices</h2></CardHeader>
              <CardContent>
                {serverData.invoices.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-surface-muted p-6 text-center">
                    <ReceiptText className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-muted-foreground">No invoices yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Invoices will appear after your first billing cycle.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serverData.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                        <div><p className="text-sm font-bold">{inv.invoiceNumber}</p><p className="text-xs text-muted-foreground">{new Date(inv.issuedAt).toLocaleDateString("en-IN")}</p></div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black">₹{inv.amount.toLocaleString("en-IN")}</span>
                          <Badge variant={inv.status === "paid" ? "success" : "warning"}>{inv.status}</Badge>
                          {inv.pdfUrl ? <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground" aria-label="Download invoice"><Download className="size-4" /></a> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><h2 className="text-2xl font-black">Payment Method</h2><p className="text-sm text-muted-foreground">Managed securely via Razorpay</p></CardHeader>
              <CardContent>
                {serverData.paymentMethod ? (
                  <div className="rounded-md border border-border bg-background p-4">
                    <div className="flex items-center gap-3">
                      <CreditCard className="size-8 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-bold">{serverData.paymentMethod.brand} •••• {serverData.paymentMethod.last4}</p>
                        <p className="text-xs text-muted-foreground">Expires {serverData.paymentMethod.expiryMonth}/{serverData.paymentMethod.expiryYear} · {serverData.paymentMethod.isDefault ? "Default" : "Backup"}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border bg-surface-muted p-6 text-center">
                    <CreditCard className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-muted-foreground">No payment method</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add a card to enable auto-renewal.</p>
                    <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm" type="button">Add Payment Method</button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Auto-renew + Cancel */}
          <Card>
            <CardHeader><h2 className="text-2xl font-black">Subscription Settings</h2></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border bg-background p-4">
                <div><p className="text-sm font-bold">Auto-Renewal</p><p className="text-xs text-muted-foreground">Automatically renew your subscription each billing cycle</p></div>
                <button className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${serverData.autoRenew ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} disabled={autoRenewPending} onClick={handleToggleAutoRenew} type="button">
                  {autoRenewPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {serverData.autoRenew ? "Enabled" : "Disabled"}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4">
                <div><p className="text-sm font-bold text-red-800">Cancel Subscription</p><p className="text-xs text-red-600">Your data will be retained for 30 days after cancellation</p></div>
                <button className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition-all hover:bg-red-100" onClick={() => setShowCancel(true)} type="button">Cancel</button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: ADD-ONS ═══ */}
      {activeTab === "addons" ? (
        <div className="space-y-5">
          <Card>
            <CardHeader><h2 className="text-2xl font-black">Add-On Marketplace</h2><p className="text-sm text-muted-foreground">Enhance your plan with additional features and services</p></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {serverData.availableAddons.map((addon) => {
                  const isAssigned = serverData.currentAddons.some((a) => a.name === addon.name);
                  return (
                    <div key={addon.name} className={`rounded-lg border p-4 transition-all ${isAssigned ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-border-strong"}`}>
                      <div className="flex flex-col gap-3">
                        <div><p className="text-sm font-bold">{addon.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{addon.description}</p></div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black">₹{addon.price.toLocaleString("en-IN")}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                          {isAssigned ? (
                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"><Check className="size-3" /> Added</span>
                          ) : (
                            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm" onClick={async () => {
                              const fd = new FormData(); fd.set("addonName", addon.name); fd.set("addonPrice", String(addon.price));
                              const r = await assignAddonAction(initialAuthActionState, fd);
                              showToast(r.message || "Requested", r.status === "success" ? "success" : "error");
                            }} type="button">Add</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══ TAB: TIMELINE ═══ */}
      {activeTab === "timeline" ? (
        <Card>
          <CardHeader><h2 className="text-2xl font-black">Subscription Timeline</h2></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="size-3 rounded-full bg-green-500" /><div className="pb-6"><p className="text-sm font-bold">Subscription Created</p>                <p className="text-xs text-muted-foreground">Plan: {planContext.packageName}</p></div>
              </div>
              {isTrialing && planContext.trialEndsAt ? (
                <div className="flex items-start gap-4">
                  <div className="size-3 rounded-full bg-blue-500" /><div className="pb-6"><p className="text-sm font-bold">Trial Period</p><p className="text-xs text-muted-foreground">Ends {planContext.trialEndsAt.toLocaleDateString("en-IN")}</p></div>
                </div>
              ) : null}
              {serverData.currentAddons.map((a) => (
                <div key={a.name} className="flex items-start gap-4">
                  <div className="size-3 rounded-full bg-purple-500" /><div className="pb-6"><p className="text-sm font-bold">Add-On Added: {a.name}</p><p className="text-xs text-muted-foreground">{new Date(a.assignedAt).toLocaleDateString("en-IN")}</p></div>
                </div>
              ))}
              <div className="flex items-start gap-4">
                <div className="size-3 rounded-full border-2 border-dashed border-border" />
                <div><p className="text-sm font-bold text-muted-foreground">Present Day</p><p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN")}</p></div>
              </div>
              {planContext.expiresAt ? (
                <div className="flex items-start gap-4">
                  <div className="size-3 rounded-full bg-amber-500" /><div><p className="text-sm font-bold">Next Renewal</p><p className="text-xs text-muted-foreground">{planContext.expiresAt.toLocaleDateString("en-IN")}</p></div>
                </div>
              ) : null}
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
              <div><h3 className="text-lg font-black">Cancel Subscription</h3><p className="text-sm text-muted-foreground">This action cannot be undone. Your data will be retained for 30 days.</p></div>
            </div>
            <form action={cancelAction} className="space-y-4">
              {cancelState.message ? (
                <div className={`rounded-md border p-3 text-sm font-semibold ${cancelState.status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>{cancelState.message}</div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-bold">Reason for cancelling <span className="text-red-500">*</span></label>
                <textarea className={`${selectClass} min-h-[80px]`} name="reason" required placeholder="Tell us why you're leaving..." rows={3} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">What could we improve?</label>
                <select className={selectClass} name="retentionFeedback">
                  <option value="">Select a reason</option>
                  <option value="too_expensive">Too expensive</option>
                  <option value="missing_features">Missing features</option>
                  <option value="switching">Switching to another platform</option>
                  <option value="not_using">Not using the platform enough</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Type <kbd className="rounded border border-border bg-background px-2 py-0.5 text-xs font-mono">CANCEL</kbd> to confirm <span className="text-red-500">*</span></label>
                <input className={selectClass} name="confirmation" required placeholder="Type CANCEL here" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={() => setShowCancel(false)} type="button">Keep Subscription</button>
                <button className="inline-flex items-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-50" disabled={cancelPending} type="submit">
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
