"use client";

import { AlertTriangle, CheckCircle2, Info, TrendingUp } from "lucide-react";
import type { LimitCheckResult } from "@/features/super-admin/services/limit-engine";

type UsageDashboardProps = {
  usage: {
    memberCount: number;
    trainerCount: number;
    staffCount: number;
    gymCount: number;
    branchCount: number;
  };
  limits: Array<LimitCheckResult & { code: string; label: string }>;
  overLimitCount: number;
  warningCount: number;
  healthyCount: number;
  packageName: string;
};

const LIMIT_ICONS: Record<string, string> = {
  max_members: "👥",
  max_trainers: "🏋️",
  max_staff: "👔",
  max_gyms: "🏢",
  max_branches: "📍",
};

export function UsageDashboard({ usage, limits, overLimitCount, warningCount, healthyCount, packageName }: UsageDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Healthy" count={healthyCount} color="green" icon={<CheckCircle2 className="size-5" />} />
        <SummaryCard title="Near Limit" count={warningCount} color="amber" icon={<Info className="size-5" />} />
        <SummaryCard title="Over Limit" count={overLimitCount} color="red" icon={<AlertTriangle className="size-5" />} />
      </div>

      {/* Usage bars */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">Resource Usage</h3>
            <span className="text-sm text-muted-foreground">{packageName} plan</span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {limits.map((limit) => (
            <UsageBar key={limit.code} limit={limit} />
          ))}
        </div>
      </div>

      {/* Upgrade prompt for over-limit */}
      {overLimitCount > 0 && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-1 size-6 shrink-0 text-red-500" />
            <div>
              <h4 className="font-black text-red-800">You've hit your plan limits</h4>
              <p className="mt-1 text-sm text-red-700">
                {overLimitCount} resource(s) are at capacity. Upgrade your plan to continue adding resources without interruption.
              </p>
              <a href="/organization/plan" className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
                View Upgrade Options
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, count, color, icon }: { title: string; count: number; color: string; icon: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] ?? ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider">{title}</p>
          <p className="mt-1 text-3xl font-black">{count}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function UsageBar({ limit }: { limit: LimitCheckResult & { code: string; label: string } }) {
  const color = !limit.ok ? "red" : limit.percentUsed >= 90 ? "red" : limit.percentUsed >= 80 ? "amber" : "accent";
  const barColor = !limit.ok ? "bg-red-500" : limit.percentUsed >= 90 ? "bg-red-500" : limit.percentUsed >= 80 ? "bg-amber-500" : "bg-accent";
  const displayPercent = limit.limit === -1 ? 0 : Math.min(limit.percentUsed, 100);
  const isUnlimited = limit.limit === -1;
  const icon = LIMIT_ICONS[limit.code] ?? "📊";

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-bold">{limit.label}</span>
        </div>
        <span className="font-semibold text-muted-foreground">
          {isUnlimited
            ? `${limit.usage.toLocaleString()} / Unlimited`
            : `${limit.usage.toLocaleString()} / ${limit.limit.toLocaleString()}`}
        </span>
      </div>

      {!isUnlimited && (
        <div className="mt-2">
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(displayPercent, 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{displayPercent}% used</span>
            {limit.remaining > 0 && limit.remaining <= limit.limit * 0.2 && (
              <span className="font-semibold text-amber-600">{limit.remaining} remaining</span>
            )}
          </div>
        </div>
      )}

      {!limit.ok && limit.error && (
        <p className="mt-2 text-xs font-semibold text-red-600">{limit.error}</p>
      )}
      {limit.ok && limit.percentUsed >= 80 && (
        <p className="mt-2 text-xs font-semibold text-amber-600">Approaching capacity — consider upgrading soon.</p>
      )}
    </div>
  );
}
