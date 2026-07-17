"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { showToast } from "@/components/ui/toast";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
  renewSubscriptionAction,
  downgradePlanAction,
  upgradePlanAction,
} from "@/features/super-admin/actions/subscription-enterprise-actions";
import { formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { OrganizationDetailData } from "../../services/organization-management-service";
import type { PackageRow } from "../../services/subscription-service";

type ActionState = {
  kind: string;
  message: string;
  tone: "success" | "error" | "warning" | "info";
} | null;

type ActionPreview = {
  kind: "upgrade" | "downgrade" | "cancel";
  title: string;
  description: string;
  riskLevel: "medium" | "high" | "critical";
  confirmLabel: string;
  requireConfirmationText: string;
  onConfirm: () => void;
  details: Array<{ label: string; value: string }>;
};

export function OrgSubscriptionControlPanel({
  data,
  criticalSuperAdminEmail,
}: {
  data: OrganizationDetailData;
  criticalSuperAdminEmail: string;
}) {
  const [stepUpEmail, setStepUpEmail] = useState(criticalSuperAdminEmail);
  const [reason, setReason] = useState("");
  const [cancelType, setCancelType] = useState<"immediate" | "end_of_period">("end_of_period");
  const [cancellationCategory, setCancellationCategory] = useState("other");
  const [dataRetentionDays, setDataRetentionDays] = useState("90");
  const [pendingAction, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const router = useRouter();

  const subscription = data.record.subscription;
  const currentPackage = useMemo(
    () => data.packages.find((pkg) => pkg.id === subscription.packageId) ?? null,
    [data.packages, subscription.packageId],
  );
  const currentPackageSortOrder = currentPackage?.sort_order ?? null;
  const billingPeriod = subscription.billingPeriod ?? currentPackage?.billing_period ?? "monthly";
  const renewLabel = billingPeriod === "annual" ? "Renew annual term" : "Renew monthly term";

  const availablePackages = useMemo(() => {
    return [...data.packages]
      .filter((pkg) => pkg.id !== subscription.packageId)
      .map((pkg) => ({
        pkg,
        direction: currentPackageSortOrder === null ? "change" : (pkg.sort_order >= currentPackageSortOrder ? "upgrade" : "downgrade"),
      }));
  }, [currentPackageSortOrder, data.packages, subscription.packageId]);

  const setActionState = (kind: string, message: string, tone: ActionState["tone"]) => {
    setState({ kind, message, tone });
  };

  const runAction = (kind: string, action: () => Promise<{ status: string; message?: string }>) => {
    startTransition(() => {
      void action().then((result) => {
        if (result.status === "success") {
          setActionState(kind, result.message ?? "Action completed.", "success");
          showToast(result.message ?? "Action completed.", "success");
          router.refresh();
          return;
        }

        const tone = kind === "cancel" || kind === "downgrade" ? "warning" : "error";
        setActionState(kind, result.message ?? "Action failed.", tone);
        showToast(result.message ?? "Action failed.", "error");
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Action failed.";
        setActionState(kind, message, "error");
        showToast(message, "error");
      });
    });
  };

  const openPlanPreview = (targetPackage: PackageRow, direction: "upgrade" | "downgrade" | "change") => {
    if (!subscription.subscriptionId) {
      setActionState(direction, "No subscription is assigned to this organization.", "error");
      return;
    }

    const isDowngrade = direction === "downgrade";
    const currentLabel = currentPackage?.name ?? subscription.packageName ?? "Unassigned";
    const targetLabel = targetPackage.name;
    const price = typeof targetPackage.price === "number" ? formatCurrency(targetPackage.price, "INR") : "Custom pricing";

    setPreview({
      kind: direction === "downgrade" ? "downgrade" : "upgrade",
      title: isDowngrade ? "Confirm downgrade" : "Confirm upgrade",
      description: isDowngrade
        ? "Review the target package, reason, and billing impact before applying the downgrade."
        : "Review the target package, reason, and billing impact before applying the upgrade.",
      riskLevel: isDowngrade ? "high" : "medium",
      confirmLabel: isDowngrade ? "Confirm downgrade" : "Confirm upgrade",
      requireConfirmationText: isDowngrade ? "DOWNGRADE" : "UPGRADE",
      onConfirm: () => {
        const payload = {
          subscriptionId: subscription.subscriptionId as string,
          organizationId: data.record.organization.id,
          newPackageId: targetPackage.id,
          reason: reason.trim() || undefined,
          stepUpEmail,
        };
        runAction(isDowngrade ? "downgrade" : "upgrade", () => (isDowngrade ? downgradePlanAction(payload) : upgradePlanAction(payload)));
      },
      details: [
        { label: "Current package", value: currentLabel },
        { label: "Target package", value: targetLabel },
        { label: "Price", value: price },
        { label: "Billing period", value: billingPeriod },
        { label: "Step-up email", value: stepUpEmail },
      ],
    });
  };

  const handleRenew = () => {
    if (!subscription.subscriptionId) {
      setActionState("renew", "No subscription is assigned to this organization.", "error");
      return;
    }

    runAction("renew", () => renewSubscriptionAction({
      subscriptionId: subscription.subscriptionId,
      organizationId: data.record.organization.id,
      stepUpEmail,
      reason: reason.trim() || undefined,
    }));
  };

  const handleReactivate = () => {
    if (!subscription.subscriptionId) {
      setActionState("reactivate", "No subscription is assigned to this organization.", "error");
      return;
    }

    runAction("reactivate", () => reactivateSubscriptionAction({
      subscriptionId: subscription.subscriptionId,
      organizationId: data.record.organization.id,
      stepUpEmail,
      reason: reason.trim() || undefined,
    }));
  };

  const openCancelPreview = () => {
    if (!subscription.subscriptionId) {
      setActionState("cancel", "No subscription is assigned to this organization.", "error");
      return;
    }

    setPreview({
      kind: "cancel",
      title: "Confirm cancellation",
      description: "Review the cancellation mode, retention window, and reason before applying the subscription cancellation.",
      riskLevel: "critical",
      confirmLabel: "Confirm cancellation",
      requireConfirmationText: "CANCEL",
      onConfirm: () => runAction("cancel", () => cancelSubscriptionAction({
        subscriptionId: subscription.subscriptionId as string,
        organizationId: data.record.organization.id,
        cancelType,
        cancellationCategory: cancellationCategory === "other"
          ? undefined
          : (cancellationCategory as "too_expensive" | "missing_features" | "poor_support" | "not_using" | "switching_competitor" | "business_closed" | "technical_issues" | "other"),
        reason: reason.trim() || "Manual cancellation by Super Admin.",
        dataRetentionDays: Number(dataRetentionDays) || 90,
        stepUpEmail,
      })),
      details: [
        { label: "Mode", value: cancelType === "immediate" ? "Immediate" : "End of billing period" },
        { label: "Retention days", value: String(Number(dataRetentionDays) || 90) },
        { label: "Category", value: cancellationCategory === "other" ? "Other" : formatEnterpriseLabel(cancellationCategory) },
        { label: "Step-up email", value: stepUpEmail },
      ],
    });
  };

  const renewalHint = subscription.nextBillingDate
    ? `Next billing is currently scheduled for ${formatDateTime(subscription.nextBillingDate)}.`
    : "No next billing date is currently scheduled.";

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            <h3 className="text-xl font-black">Subscription Operations</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Current package</p>
              <p className="mt-2 text-lg font-black">{currentPackage?.name ?? subscription.packageName ?? "Unassigned"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription.status ? formatEnterpriseLabel(subscription.status) : "No subscription status"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{renewalHint}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Action inputs</p>
              <div className="mt-3 space-y-3">
                <Input value={stepUpEmail} onChange={(event) => setStepUpEmail(event.target.value)} placeholder={criticalSuperAdminEmail} type="email" />
                <Textarea className="min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason, approval context, or customer note" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Button type="button" variant="secondary" onClick={handleRenew} disabled={pendingAction}>
              {pendingAction ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
              {renewLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleReactivate}
              disabled={pendingAction || subscription.status === "active"}
            >
              Reactivate
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={openCancelPreview}
              disabled={pendingAction}
            >
              Cancel Subscription
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Cancellation mode</label>
              <select className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" value={cancelType} onChange={(event) => setCancelType(event.target.value as "immediate" | "end_of_period")}>
                <option value="end_of_period">End of billing period</option>
                <option value="immediate">Immediate</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Retention days</label>
              <Input className="mt-2" type="number" min={0} max={365} value={dataRetentionDays} onChange={(event) => setDataRetentionDays(event.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Cancellation category</label>
            <select className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" value={cancellationCategory} onChange={(event) => setCancellationCategory(event.target.value)}>
              <option value="other">Other</option>
              <option value="too_expensive">Too expensive</option>
              <option value="missing_features">Missing features</option>
              <option value="poor_support">Poor support</option>
              <option value="not_using">Not using</option>
              <option value="switching_competitor">Switching competitor</option>
              <option value="business_closed">Business closed</option>
              <option value="technical_issues">Technical issues</option>
            </select>
          </div>

          <InlineMfaStepUp compact />

          {state ? (
            <div
              className={`rounded-xl border p-4 text-sm font-semibold ${
                state.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : state.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : state.tone === "info"
                      ? "border-sky-200 bg-sky-50 text-sky-900"
                      : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {state.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowUp className="size-5" />
            <h3 className="text-xl font-black">Plan Change Targets</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {availablePackages.length > 0 ? (
            availablePackages.map(({ pkg, direction }) => {
              const isUpgrade = direction !== "downgrade";
              const price = typeof pkg.price === "number" ? formatCurrency(pkg.price, "INR") : "Custom pricing";

              return (
                <div key={pkg.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">{pkg.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pkg.description ?? "No description available."}</p>
                      <p className="mt-2 text-sm font-semibold">{price}</p>
                    </div>
                    <Badge variant={isUpgrade ? "success" : "warning"}>{isUpgrade ? "Upgrade" : "Downgrade"}</Badge>
                  </div>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant={isUpgrade ? "primary" : "secondary"}
                    onClick={() => openPlanPreview(pkg, isUpgrade ? "upgrade" : "downgrade")}
                    disabled={pendingAction}
                  >
                    {isUpgrade ? <ArrowUp className="mr-2 size-4" /> : <ArrowDown className="mr-2 size-4" />}
                    {isUpgrade ? "Upgrade to this plan" : "Downgrade to this plan"}
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">No alternate packages are available.</p>
          )}
        </CardContent>
      </Card>

      {preview ? (
        <ConfirmDialog
          open
          onClose={() => setPreview(null)}
          title={preview.title}
          description={preview.description}
          riskLevel={preview.riskLevel}
          confirmAction={{
            label: preview.confirmLabel,
            onClick: preview.onConfirm,
            variant: preview.kind === "cancel" ? "destructive" : "primary",
          }}
          requireConfirmationText={preview.requireConfirmationText}
        >
          <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
            {preview.details.map((detail) => (
              <div key={detail.label} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{detail.label}</span>
                <span className="max-w-[60%] break-words text-right font-black">{detail.value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
