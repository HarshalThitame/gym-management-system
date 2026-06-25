"use client";

import type { ReactNode } from "react";
import { Activity, Building2, Cpu, HardDrive, MessageSquare, Users, CalendarDays, ChartLine } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import type { OrganizationManagementRecord, UsageSnapshotRow } from "../../services/organization-management-service";

type UsageLimitInfo = {
  label: string;
  icon: ReactNode;
  current: number;
  limit: number;
  unit?: string;
};

export function OrgUsageTab({ record, usageSnapshots = [] }: { record: OrganizationManagementRecord; usageSnapshots?: UsageSnapshotRow[] }) {
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

  const snapshotsAsc = [...usageSnapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );
  const chartData = snapshotsAsc.map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    members: s.member_count,
    branches: s.branch_count,
    trainers: s.active_trainers,
    storage: s.storage_gb,
  }));

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

      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChartLine className="size-5 text-muted-foreground" />
              <h3 className="text-xl font-black">Usage Trend</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Last {chartData.length} snapshot(s)</p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7dbd0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#888" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#888" />
                  <Tooltip
                    contentStyle={{ fontSize: 13, borderRadius: 8 }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="members"
                    name="Members"
                    stroke="#2563EB"
                    fill="#2563EB"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="branches"
                    name="Branches"
                    stroke="#16A34A"
                    fill="#16A34A"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  {chartData.some((d) => d.trainers > 0) && (
                    <Area
                      type="monotone"
                      dataKey="trainers"
                      name="Trainers"
                      stroke="#D97706"
                      fill="#D97706"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-muted-foreground" />
              <h3 className="text-xl font-black">Revenue Summary</h3>
            </div>
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
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-muted-foreground" />
              <h3 className="text-xl font-black">Recent Usage Snapshots</h3>
            </div>
          </CardHeader>
          <CardContent>
            {usageSnapshots.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Members</th>
                      <th className="pb-2 pr-3">Branches</th>
                      <th className="pb-2 pr-3">Storage</th>
                      <th className="pb-2 pr-3">API</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageSnapshots.slice(0, 10).map((snap) => (
                      <tr key={snap.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 font-semibold">
                          {new Date(snap.snapshot_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="py-2 pr-3">{formatCompactNumber(snap.member_count)}</td>
                        <td className="py-2 pr-3">{formatCompactNumber(snap.branch_count)}</td>
                        <td className="py-2 pr-3">{snap.storage_gb.toFixed(1)} GB</td>
                        <td className="py-2 pr-3">{formatCompactNumber(snap.api_calls_last_30d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">No usage snapshots available yet. Snapshots are taken daily via cron.</p>
            )}
          </CardContent>
        </Card>
      </div>

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
