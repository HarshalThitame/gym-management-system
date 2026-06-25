"use client";

import type { ReactNode } from "react";
import { Activity, Building2, Cpu, HardDrive, MessageSquare, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import type { OrganizationManagementRecord } from "../../services/organization-management-service";

type UsageLimitInfo = {
  label: string;
  icon: ReactNode;
  current: number;
  limit: number;
  unit?: string;
};

export function OrgUsageTab({ record }: { record: OrganizationManagementRecord }) {
  const limits: UsageLimitInfo[] = [
    { label: "Members", icon: <Users className="size-4" />, current: record.usage.activeMembers, limit: record.subscription.maxMembers ?? -1 },
    { label: "Branches", icon: <Building2 className="size-4" />, current: record.usage.activeBranches, limit: record.subscription.maxBranches ?? -1 },
    { label: "Gyms", icon: <Activity className="size-4" />, current: record.usage.gyms, limit: -1 },
    { label: "Trainers", icon: <Users className="size-4" />, current: record.usage.trainers, limit: -1 },
    { label: "Staff", icon: <Users className="size-4" />, current: record.usage.staff, limit: -1 },
    { label: "Storage", icon: <HardDrive className="size-4" />, current: 0, limit: -1, unit: "GB" },
    { label: "API Calls", icon: <Cpu className="size-4" />, current: 0, limit: -1 },
    { label: "SMS", icon: <MessageSquare className="size-4" />, current: 0, limit: -1 },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Usage vs Limits</h3>
          <p className="mt-1 text-sm text-muted-foreground">Current resource consumption against plan entitlements</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {limits.map((item) => (
              <UsageProgressCard key={item.label} {...item} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Revenue Summary</h3>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Total Revenue</p>
            <p className="mt-1 text-3xl font-black">{formatCurrency(record.usage.revenue)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricBlock label="Active Members" value={formatCompactNumber(record.usage.activeMembers)} />
            <MetricBlock label="Total Members" value={formatCompactNumber(record.usage.members ?? record.usage.activeMembers)} />
            <MetricBlock label="Branches" value={`${record.usage.activeBranches}/${record.usage.branches}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Health Signals</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {record.health.factors.length > 0 ? record.health.factors.map((factor) => (
              <div key={factor} className="rounded-md border border-border bg-background p-3 text-sm font-semibold text-muted-foreground">
                {factor}
              </div>
            )) : (
              <p className="text-sm font-semibold text-muted-foreground">No health signals.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsageProgressCard({ label, icon, current, limit, unit }: UsageLimitInfo) {
  const ratio = limit > 0 ? current / limit : 0;
  const color = ratio < 0.7 ? "#16A34A" : ratio < 0.9 ? "#D97706" : "#D92D20";

  return (
    <div className="rounded-lg border border-border bg-background p-4 transition-all hover:border-border-strong">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-black">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {current}{unit ?? ""} / {limit === -1 ? "∞" : `${limit}${unit ?? ""}`}
        </span>
      </div>
      {limit > 0 && (
        <div className="mt-3 h-2 rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(ratio * 100, 100)}%`,
              backgroundColor: color
            }}
          />
        </div>
      )}
      {limit === -1 && (
        <p className="mt-2 text-xs text-muted-foreground">Unlimited plan</p>
      )}
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Math.round(value));
}