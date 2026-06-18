"use client";

import { Clock, ArrowUpRight, AlertTriangle, CheckCircle2, CreditCard, Shield } from "lucide-react";
import { useEntitlements } from "./entitlement-provider";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PlanStatus = "active" | "trial" | "cancelled" | "expired" | "suspended" | "pending_activation" | "none";

const statusConfig: Record<PlanStatus, { color: string; label: string; icon: typeof CheckCircle2 }> = {
  active: { color: "bg-green-100 text-green-800 border-green-200", label: "Active", icon: CheckCircle2 },
  trial: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Trial", icon: Clock },
  cancelled: { color: "bg-red-100 text-red-800 border-red-200", label: "Cancelled", icon: AlertTriangle },
  expired: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Expired", icon: AlertTriangle },
  suspended: { color: "bg-amber-100 text-amber-800 border-amber-200", label: "Suspended", icon: AlertTriangle },
  pending_activation: { color: "bg-purple-100 text-purple-800 border-purple-200", label: "Scheduled", icon: Clock },
  none: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "No Plan", icon: AlertTriangle },
};

export function PlanSummaryCard() {
  const { plan, activeFeatureKeys } = useEntitlements();

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-black">Plan Status</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">No Active Plan</p>
              <p className="text-xs text-amber-700 mt-1">Your organization does not have an active subscription. Choose a plan to unlock features.</p>
            </div>
          </div>
          <Button variant="primary" className="w-full" onClick={() => window.location.assign("/organization/plan?tab=pay")} type="button">
            Choose a Plan <ArrowUpRight className="size-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = (plan.status || "none") as PlanStatus;
  const cfg = statusConfig[status] ?? statusConfig.none;
  const StatusIcon = cfg.icon;

  const activeCount = activeFeatureKeys.size;
  const totalModuleCount = organizationOwnerModules.filter((m) => m.featureKey).length;
  const lockedCount = totalModuleCount - [...activeFeatureKeys].filter((k) => organizationOwnerModules.some((m) => m.featureKey === k)).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-black">Plan Status</h2>
          </div>
          <Badge variant={status === "active" || status === "trial" ? "success" : status === "cancelled" || status === "expired" ? "error" : "info"}>
            <StatusIcon className="size-3 mr-1" /> {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className="text-sm font-bold">{plan.name}</span>
          </div>
          {plan.endDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {status === "cancelled" ? "Active Until" : status === "expired" ? "Expired On" : "Renews/Expires"}
              </span>
              <span className="text-sm font-semibold" suppressHydrationWarning>
                {new Date(plan.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          )}
          {plan.remainingDays !== null && plan.remainingDays > 0 && status !== "expired" && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Remaining</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                plan.remainingDays <= 3 ? "bg-red-50 text-red-700 border border-red-200" :
                  plan.remainingDays <= 7 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                    "bg-green-50 text-green-700 border border-green-200"
              )}>
                <Clock className="size-3" />
                {plan.remainingDays} day{plan.remainingDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Features</span>
            <span className="text-sm">
              <span className="font-bold text-green-600">{activeCount}</span>
              <span className="text-muted-foreground"> active</span>
              {lockedCount > 0 && (
                <span className="text-muted-foreground"> · </span>
              )}
              {lockedCount > 0 && (
                <span className="font-bold text-amber-600">{lockedCount}</span>
              )}
              {lockedCount > 0 && (
                <span className="text-muted-foreground"> locked</span>
              )}
            </span>
          </div>
        </div>

        {/* Critical states */}
        {status === "expired" && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-800">Plan Expired</p>
              <p className="text-xs text-red-700 mt-1">Your plan has expired. Features are locked. Renew to regain access.</p>
            </div>
          </div>
        )}

        {status === "cancelled" && plan.endDate && plan.remainingDays !== null && plan.remainingDays > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Shield className="size-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-800">Cancelled — Active Until Expiry</p>
              <p className="text-xs text-amber-700 mt-1">Your plan remains active until {new Date(plan.endDate).toLocaleDateString("en-IN")}. After that, features will be locked.</p>
            </div>
          </div>
        )}

        {status === "suspended" && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-800">Subscription Suspended</p>
              <p className="text-xs text-red-700 mt-1">Your subscription has been suspended. Contact support to resolve this.</p>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          className="w-full"
          onClick={() => window.location.assign("/organization/plan")}
          type="button"
        >
          {status === "expired" || status === "cancelled" ? "Renew Plan" : "Manage Plan"}
          <ArrowUpRight className="size-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
