"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Info,
  Loader2,
  Minus,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { OrgFeatureFlags } from "@/lib/tenant";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import type { OrgUsage, UsageWarning } from "@/features/super-admin/services/subscription-usage-types";
import { getUsageWarnings } from "@/features/super-admin/services/subscription-usage-types";
import type { AddonDefinition, AssignedAddon } from "@/features/super-admin/services/subscription-addon-service";
import type { PackageRow } from "@/features/super-admin/services/subscription-service";

type OrgSubscriptionProps = {
  organizationId: string;
  planContext: OrgPlanContext;
  startedAt: string | null;
  subscriptionId: string | null;
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
  advancedReportsEnabled: "Advanced Reports",
  customDomainEnabled: "Custom Domain",
  apiAccessEnabled: "API Access",
  notificationsEnabled: "Notifications",
  whiteLabelEnabled: "White Label",
};

export function OrgSubscriptionManagement({ organizationId, planContext, startedAt, subscriptionId }: OrgSubscriptionProps) {
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [warnings, setWarnings] = useState<UsageWarning[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [addons, setAddons] = useState<AddonDefinition[]>([]);
  const [assignedAddons, setAssignedAddons] = useState<AssignedAddon[]>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usageRes, pkgRes, addonsRes, assignedRes, eventsRes] = await Promise.all([
          fetch(`/api/subscription-usage?organizationId=${encodeURIComponent(organizationId)}`),
          fetch(`/api/subscription-packages`),
          fetch(`/api/subscription-addons/available?packageId=${encodeURIComponent(planContext.packageName)}`),
          subscriptionId ? fetch(`/api/subscription-addons/assigned?subscriptionId=${encodeURIComponent(subscriptionId)}`) : null,
          subscriptionId ? fetch(`/api/subscription-events?organizationId=${encodeURIComponent(organizationId)}&limit=20`) : null,
        ]);

        const [usageData, pkgData] = await Promise.all([
          usageRes.ok ? usageRes.json() : null,
          pkgRes.ok ? pkgRes.json() : [],
        ]);

        if (usageData) {
          setUsage(usageData);
          setWarnings(getUsageWarnings(usageData));
        }
        setPackages(pkgData);

        if (addonsRes?.ok) {
          const addonData = await addonsRes.json();
          setAddons(addonData);
        }

        if (assignedRes?.ok) {
          const assignedData = await assignedRes.json();
          setAssignedAddons(assignedData);
        }

        if (eventsRes?.ok) {
          const eventData = await eventsRes.json();
          setEvents(eventData);
        }
      } catch {
        setError("Failed to load subscription data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, subscriptionId, planContext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
        <Loader2 className="size-8 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading subscription data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ToastContainer />

      {planContext.isTrialing && (
        <TrialBanner trialEndsAt={planContext.trialEndsAt} subscriptionId={subscriptionId} organizationId={organizationId} />
      )}

      {planContext.isSuspended && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800" role="alert">
          <AlertTriangle className="mr-2 inline size-4" />
          Your subscription is {planContext.status}. Features are locked. Contact support to reactivate.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`rounded-md border p-3 text-sm font-semibold ${
                w.level === "over_limit"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : w.level === "critical"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
              role="alert"
            >
              {w.level === "over_limit" ? <XCircle className="mr-2 inline size-4" /> : w.level === "critical" ? <AlertTriangle className="mr-2 inline size-4" /> : <Info className="mr-2 inline size-4" />}
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <CurrentPlanCard planContext={planContext} startedAt={startedAt} usage={usage} />
        <UsageCard usage={usage} />
        {subscriptionId && <AddonSummaryCard assignedAddons={assignedAddons} />}
      </div>

      {subscriptionId && usage && !usage.isOverMemberLimit && !usage.isOverBranchLimit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">Available Plans</h2>
              <Button onClick={() => setShowUpgrade(!showUpgrade)} variant="ghost" size="sm">
                {showUpgrade ? "Hide" : "Compare & Upgrade"}
              </Button>
            </div>
          </CardHeader>
          {showUpgrade && (
            <CardContent>
              <PlanComparisonTable
                packages={packages}
                currentPackageName={planContext.packageName}
                currentFeatures={planContext.features}
                subscriptionId={subscriptionId}
                organizationId={organizationId}
              />
            </CardContent>
          )}
        </Card>
      )}

      {subscriptionId && addons.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">Add-Ons</h2>
          </CardHeader>
          <CardContent>
            <AddonSection
              addons={addons}
              assignedAddons={assignedAddons}
              subscriptionId={subscriptionId}
              onAssignedChanged={() => {
                fetch(`/api/subscription-addons/assigned?subscriptionId=${encodeURIComponent(subscriptionId)}`).then(async (r) => { if (r.ok) return r.json(); }).then(setAssignedAddons).catch(() => {});
                fetch(`/api/subscription-events?organizationId=${encodeURIComponent(organizationId)}&limit=20`).then(async (r) => { if (r.ok) return r.json(); }).then(setEvents).catch(() => {});
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Features</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(featureLabels).map(([key, label]) => {
              const enabled = planContext.features[key as keyof OrgFeatureFlags] as boolean;
              return (
                <div key={key} className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-4">
                  <span className="text-sm font-semibold">{label}</span>
                  {enabled ? (
                    <span className="inline-flex items-center gap-1 text-sm font-black text-green-700">
                      <CheckCircle2 className="size-4" /> Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-black text-muted-foreground">
                      <XCircle className="size-4" /> Locked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">Subscription Timeline</h2>
              <Button onClick={() => setShowTimeline(!showTimeline)} variant="ghost" size="sm">
                {showTimeline ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showTimeline && (
            <CardContent>
              <div className="space-y-3">
                {events.slice(0, 20).map((event) => (
                  <div key={event.id as string} className="flex items-start gap-3 rounded-md border border-border bg-surface-muted p-3">
                    <div className="mt-0.5 shrink-0">
                      <EventIcon eventType={event.event_type as string} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold capitalize">{formatEventType(event.event_type as string)}</p>
                      {event.reason ? <p className="mt-0.5 text-xs text-muted-foreground">{String(event.reason)}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatDate(event.created_at as string)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {!subscriptionId && (
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-black">No Subscription</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This organization does not have an active subscription package yet. Contact your Super Admin to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CurrentPlanCard({ planContext, startedAt, usage }: { planContext: OrgPlanContext; startedAt: string | null; usage: OrgUsage | null }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-black">Current Plan</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Package</p>
          <p className="mt-1 text-2xl font-black">{planContext.packageName}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</p>
            <Badge className="mt-1" variant={planContext.status === "active" ? "success" : planContext.status === "trial" ? "info" : "error"}>
              {planContext.status}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Started</p>
            <p className="mt-1 text-sm font-bold">{startedAt ? new Date(startedAt).toLocaleDateString("en-IN") : "N/A"}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Expires</p>
            <p className="mt-1 text-sm font-bold">{planContext.expiresAt ? planContext.expiresAt.toLocaleDateString("en-IN") : "No expiry"}</p>
          </div>
          {planContext.trialEndsAt && (
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Trial Ends</p>
              <p className="mt-1 text-sm font-bold">{planContext.trialEndsAt.toLocaleDateString("en-IN")}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UsageCard({ usage }: { usage: OrgUsage | null }) {
  if (!usage) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-black">Usage</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <UsageBar
          label="Members"
          current={usage.memberCount}
          limit={usage.memberLimit}
          percent={usage.memberPercent}
          isOver={usage.isOverMemberLimit}
        />
        <UsageBar
          label="Branches"
          current={usage.branchCount}
          limit={usage.branchLimit}
          percent={usage.branchPercent}
          isOver={usage.isOverBranchLimit}
        />
      </CardContent>
    </Card>
  );
}

function UsageBar({ label, current, limit, percent, isOver }: { label: string; current: number; limit: number; percent: number; isOver: boolean }) {
  const displayPercent = limit === -1 ? 0 : Math.min(percent, 100);
  const isUnlimited = limit === -1;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="font-semibold text-muted-foreground">
          {isUnlimited ? `${current.toLocaleString("en-IN")} / Unlimited` : `${current.toLocaleString("en-IN")} / ${limit.toLocaleString("en-IN")}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOver ? "bg-red-500" : percent >= 90 ? "bg-amber-500" : percent >= 80 ? "bg-amber-400" : "bg-accent"
            }`}
            style={{ width: `${displayPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

function AddonSummaryCard({ assignedAddons }: { assignedAddons: AssignedAddon[] }) {
  const totalAddonPrice = assignedAddons.reduce((sum, a) => sum + a.totalPrice, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plus className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-black">Add-Ons</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignedAddons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No add-ons assigned to this plan.</p>
        ) : (
          assignedAddons.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-3">
              <div>
                <p className="text-sm font-bold">{a.name}</p>
                <p className="text-xs text-muted-foreground">Qty: {a.quantity}</p>
              </div>
              <p className="text-sm font-black">{(a.totalPrice / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</p>
            </div>
          ))
        )}
        {totalAddonPrice > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-bold">Total add-on cost</span>
            <span className="text-sm font-black">{(totalAddonPrice / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}/mo</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanComparisonTable({
  packages,
  currentPackageName,
  currentFeatures,
  subscriptionId,
  organizationId,
}: {
  packages: PackageRow[];
  currentPackageName: string;
  currentFeatures: OrgFeatureFlags;
  subscriptionId: string | null;
  organizationId: string;
}) {
  const available = packages.filter((p) => p.name !== currentPackageName);

  if (available.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No other plans available at this time.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-4 py-3">Feature</th>
            <th className="px-4 py-3 text-accent">{currentPackageName} (Current)</th>
            {available.map((p) => (
              <th key={p.id} className="px-4 py-3">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <ComparisonRow label="Member Limit" current={currentFeatures.maxMembers === -1 ? "Unlimited" : String(currentFeatures.maxMembers)} others={available.map((p) => p.max_members === -1 ? "Unlimited" : String(p.max_members))} />
          <ComparisonRow label="Branch Limit" current={currentFeatures.maxBranches === -1 ? "Unlimited" : String(currentFeatures.maxBranches)} others={available.map((p) => p.max_branches === -1 ? "Unlimited" : String(p.max_branches))} />
          {Object.entries(featureLabels).map(([key, label]) => {
            const currentVal = currentFeatures[key as keyof OrgFeatureFlags] as boolean;
            return (
              <ComparisonRow
                key={key}
                label={label}
                current={currentVal ? "✓" : "—"}
                others={available.map((p) => {
                  const pkgKey = key as keyof PackageRow;
                  return (p[pkgKey] as boolean) ? "✓" : "—";
                })}
                checkIcon
              />
            );
          })}
          {subscriptionId && (
            <tr>
              <td colSpan={2 + available.length} className="px-4 py-4">
                <p className="text-xs font-bold text-muted-foreground">
                  Need to upgrade or change your plan? Contact your Super Admin.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonRow({ label, current, others, checkIcon }: { label: string; current: string; others: string[]; checkIcon?: boolean }) {
  return (
    <tr className="hover:bg-surface-muted/50">
      <td className="px-4 py-3 font-semibold">{label}</td>
      <td className={`px-4 py-3 font-bold ${checkIcon && current === "✓" ? "text-green-600" : ""}`}>{current}</td>
      {others.map((val, i) => (
        <td key={i} className={`px-4 py-3 font-semibold ${checkIcon && val === "✓" ? "text-green-600" : "text-muted-foreground"}`}>{val}</td>
      ))}
    </tr>
  );
}

function TrialBanner({ trialEndsAt, subscriptionId, organizationId }: { trialEndsAt: Date | null; subscriptionId: string | null; organizationId: string }) {
  if (!trialEndsAt) return null;
  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000));

  return (
    <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold leading-6 text-cyan-900">
      <p>
        Your trial {daysRemaining > 0 ? `ends in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}` : "has ended"} ({trialEndsAt.toLocaleDateString("en-IN")}).
        {daysRemaining > 0 ? " Choose a plan to continue uninterrupted access." : " Choose a plan to reactivate your subscription."}
      </p>
    </div>
  );
}

function AddonSection({
  addons,
  assignedAddons,
  subscriptionId,
  onAssignedChanged,
}: {
  addons: AddonDefinition[];
  assignedAddons: AssignedAddon[];
  subscriptionId: string;
  onAssignedChanged: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAssign(addonId: string) {
    setAdding(addonId);
    setError("");
    try {
      const { assignAddonAction } = await import("@/features/super-admin/actions/subscription-enterprise-actions");
      const result = await assignAddonAction({ subscriptionId, addonId, quantity: 1 });
      if (result.status === "success") {
        showToast("Add-on assigned", "success");
        onAssignedChanged();
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign add-on.");
    } finally {
      setAdding(null);
    }
  }

  async function handleRemove(assignedAddonId: string) {
    setError("");
    try {
      const { removeAddonAction } = await import("@/features/super-admin/actions/subscription-enterprise-actions");
      const result = await removeAddonAction({ assignedAddonId });
      if (result.status === "success") {
        showToast("Add-on removed", "success");
        onAssignedChanged();
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove add-on.");
    }
  }

  const assignedIds = new Set(assignedAddons.map((a) => a.addonId));
  const availableAddons = addons.filter((a) => !assignedIds.has(a.id));

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p>
      )}
      {assignedAddons.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Your Add-Ons</p>
          {assignedAddons.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-3">
              <div>
                <p className="text-sm font-bold">{a.name}</p>
                <p className="text-xs text-muted-foreground">Qty: {a.quantity} · {(a.unitPrice / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })} each</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black">{(a.totalPrice / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</p>
                <Button onClick={() => handleRemove(a.id)} size="sm" variant="ghost" aria-label={`Remove ${a.name}`}>
                  <X className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {availableAddons.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Available Add-Ons</p>
          {availableAddons.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
              <div>
                <p className="text-sm font-bold">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.description ?? ""} · {(a.unitPrice / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}/mo each · Max {a.maxQuantity}</p>
              </div>
              <Button onClick={() => handleAssign(a.id)} disabled={adding === a.id} size="sm" variant="secondary">
                {adding === a.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function getAvailableAddonsFromPackage(features: OrgFeatureFlags): Promise<AddonDefinition[]> {
  // This is a client-side helper — in production this would be fetched server-side
  return [];
}

function EventIcon({ eventType }: { eventType: string }) {
  switch (eventType) {
    case "created":
    case "trial_started":
    case "trial_converted":
    case "reactivated":
    case "payment_recovered":
      return <CheckCircle2 className="size-4 text-green-600" />;
    case "cancelled":
    case "suspended":
    case "trial_expired":
    case "payment_failed":
      return <XCircle className="size-4 text-red-600" />;
    case "upgraded":
      return <ArrowUp className="size-4 text-accent" />;
    case "downgraded":
    case "downgrade_scheduled":
      return <ArrowDown className="size-4 text-amber-600" />;
    case "limit_warning":
    case "limit_exceeded":
      return <AlertTriangle className="size-4 text-amber-600" />;
    case "addon_added":
    case "addon_removed":
      return <Plus className="size-4 text-blue-600" />;
    default:
      return <Info className="size-4 text-muted-foreground" />;
  }
}

function formatEventType(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}
