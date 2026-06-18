"use client";

import { ArrowLeft, ArrowUpRight, Lock, AlertTriangle, Clock, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlanSummary } from "@/features/entitlement";

type Props = {
  feature: string;
  reason: string;
  planSummary: PlanSummary | null;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trial: "Trial",
  cancelled: "Cancelled",
  expired: "Expired",
  suspended: "Suspended",
  pending_activation: "Scheduled",
  scheduled: "Scheduled",
  payment_pending: "Payment Pending",
  payment_failed: "Payment Failed",
  replaced: "Replaced",
  none: "No Plan",
};

const REASON_MESSAGES: Record<string, { title: string; message: string }> = {
  FEATURE_NOT_INCLUDED: { title: "Feature Not Included", message: "This feature is not included in your current plan." },
  NO_SUBSCRIPTION: { title: "No Active Plan", message: "Your organization does not have an active subscription." },
  PLAN_EXPIRED: { title: "Plan Expired", message: "Your current plan has expired. Renew to regain access to this feature." },
  PLAN_CANCELLED: { title: "Plan Cancelled", message: "Your plan has been cancelled. Choose a new plan to access this feature." },
  PLAN_SUSPENDED: { title: "Plan Suspended", message: "Your subscription is suspended. Contact support to resolve this." },
  PLAN_NOT_STARTED: { title: "Plan Not Started", message: "Your selected plan has not started yet. This feature will be available once the plan begins." },
  PLAN_REPLACED: { title: "Plan Replaced", message: "Your previous plan has been replaced by a new one. Access the new plan to continue." },
  PAYMENT_REQUIRED: { title: "Payment Required", message: "Payment is required before this feature can be used." },
  FEATURE_DISABLED: { title: "Feature Disabled", message: "This feature is currently disabled. Contact support for assistance." },
  FEATURE_UNKNOWN: { title: "Feature Unavailable", message: "This feature is not recognized. Contact support for assistance." },
  UNAUTHORIZED_ORG_ACCESS: { title: "Access Denied", message: "You do not have permission to access this feature." },
  ORGANIZATION_NOT_FOUND: { title: "Organization Not Found", message: "Your organization could not be found. Contact support." },
};

const REASON_ICONS: Record<string, typeof Lock> = {
  FEATURE_NOT_INCLUDED: Lock,
  NO_SUBSCRIPTION: CreditCard,
  PLAN_EXPIRED: Clock,
  PLAN_CANCELLED: AlertTriangle,
  PLAN_SUSPENDED: AlertTriangle,
  PLAN_NOT_STARTED: Clock,
  PLAN_REPLACED: ArrowUpRight,
  PAYMENT_REQUIRED: CreditCard,
  FEATURE_DISABLED: Lock,
  FEATURE_UNKNOWN: Lock,
  UNAUTHORIZED_ORG_ACCESS: ShieldCheck,
  ORGANIZATION_NOT_FOUND: AlertTriangle,
};

export function LockedFeaturePageClient({ feature, reason, planSummary }: Props) {
  const info = reason ? (REASON_MESSAGES[reason] ?? { title: "Feature Locked", message: reason }) : { title: "Feature Locked", message: "This feature is not available on your current plan." };
  const Icon = reason ? (REASON_ICONS[reason] ?? Lock) : Lock;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
          <div className="rounded-full bg-amber-100 p-4">
            <Icon className="size-8 text-amber-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black">{info.title}</h1>
            <p className="text-sm text-muted-foreground max-w-sm">{info.message}</p>
          </div>

          {feature && (
            <p className="rounded-md bg-surface-muted px-3 py-1.5 text-xs font-mono text-muted-foreground">
              {feature}
            </p>
          )}

          {planSummary && (planSummary.subscription || planSummary.package) ? (
            <div className="w-full rounded-lg border border-border bg-background p-4 space-y-2 text-left">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Current Plan</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {planSummary.package?.name ?? planSummary.subscription?.packageName ?? "Unknown"}
                </span>
                <Badge variant={planSummary.status === "active" || planSummary.status === "trial" ? "success" : "error"}>
                  {STATUS_LABELS[planSummary.status] ?? planSummary.status}
                </Badge>
              </div>
              {planSummary.endDate && (
                <p className="text-xs text-muted-foreground">
                  {planSummary.status === "cancelled" ? "Active until " : planSummary.status === "expired" ? "Expired on " : "Expires "}
                  {new Date(planSummary.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={() => window.location.assign("/organization/plan")} type="button">
              View Plans <ArrowUpRight className="size-4 ml-1" />
            </Button>
            <Button variant="secondary" onClick={() => window.location.assign("/organization")} type="button">
              <ArrowLeft className="size-4 mr-1" /> Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
