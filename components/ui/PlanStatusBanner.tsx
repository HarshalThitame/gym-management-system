"use client";

import { AlertTriangle, Info, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import { cn } from "@/lib/utils";

type PlanStatusBannerProps = {
  planContext: OrgPlanContext;
};

export function PlanStatusBanner({ planContext }: PlanStatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (planContext.status === "active" && !planContext.isTrialing && !planContext.isSuspended)) {
    return null;
  }

  if (planContext.isSuspended) {
    return (
      <StatusBanner
        icon={<AlertTriangle aria-hidden="true" className="size-5" />}
        message="Your subscription has expired or been suspended. Some features are currently restricted. Please contact support or upgrade your plan to restore access."
        onDismiss={() => setDismissed(true)}
        tone="danger"
      />
    );
  }

  if (planContext.isTrialing) {
    return (
      <StatusBanner
        icon={<Info aria-hidden="true" className="size-5" />}
        message={`You are on a free trial of the ${planContext.packageName} plan. Your trial ends on ${formatDate(planContext.trialEndsAt)}. Upgrade anytime to continue uninterrupted access.`}
        onDismiss={() => setDismissed(true)}
        tone="info"
      />
    );
  }

  return null;
}

function StatusBanner({
  icon,
  message,
  onDismiss,
  tone
}: {
  icon: ReactNode;
  message: string;
  onDismiss: () => void;
  tone: "danger" | "info";
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border p-4 text-sm font-semibold shadow-sm",
        tone === "info" ? "border-info/25 bg-info/10 text-info" : "border-error/25 bg-error/10 text-error"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <p className="leading-6">{message}</p>
      </div>
      <button
        aria-label="Dismiss plan status"
        className="rounded-md p-1 transition hover:bg-background/50"
        onClick={onDismiss}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function formatDate(value: Date | null) {
  if (!value) {
    return "not set";
  }

  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(value);
}

export default PlanStatusBanner;
