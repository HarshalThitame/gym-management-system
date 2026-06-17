"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from "next/dynamic";
import { useState } from "react";
import { BarChart3, Package, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { RequestQueueClient } from "./request-queue-client";

type Data = {
  error: string | null;
  organizations: any[];
  packages: any[];
  subscriptions: any[];
};

const PackageManagementClient = dynamic(
  () => import("./package-management-client").then((m) => m.PackageManagementClient),
  { ssr: false }
);

export function SubscriptionsClient({ data }: { data: Data }) {
  const [activeTab, setActiveTab] = useState<"overview" | "packages" | "requests">("overview");

  const activeSubs = data.subscriptions.filter((s: any) => s.status === "active").length;
  const trialSubs = data.subscriptions.filter((s: any) => s.status === "trial").length;
  const expiredSubs = data.subscriptions.filter((s: any) => s.status === "expired" || s.status === "suspended" || s.status === "cancelled").length;
  const unassigned = data.organizations.length - data.subscriptions.length;
  const tabs = [
    { key: "overview" as const, label: "Overview", icon: BarChart3 },
    { key: "packages" as const, label: "Package Management", icon: Package },
    { key: "requests" as const, label: "Request Queue", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          Super Admin
        </p>
        <h1 className="text-3xl font-black md:text-4xl">Subscription Management</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage SaaS packages, organization subscriptions, feature entitlements, and upgrade requests
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              type="button"
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Organizations"
              value={String(data.organizations.length)}
              detail={`${activeSubs} active · ${trialSubs} trial · ${expiredSubs} expired`}
              status={unassigned > 0 ? "watch" : "good"}
            />
            <StatCard
              label="Active Subscriptions"
              value={String(activeSubs)}
              detail={`${trialSubs} in trial · ${expiredSubs} expired/suspended`}
              status={activeSubs > 0 ? "good" : "risk"}
            />
            <StatCard
              label="Packages"
              value={String(data.packages.length)}
              detail={`${data.packages.filter((p: any) => p.is_active).length} active`}
            />
            <StatCard
              label="Unassigned"
              value={String(unassigned)}
              detail="Organizations without a plan"
              status={unassigned > 0 ? "risk" : "good"}
            />
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-border bg-background p-5">
            <h2 className="text-lg font-black">Quick Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => setActiveTab("packages")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                type="button"
              >
                <Package className="size-4" /> Manage Packages
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition-all hover:bg-accent/10"
                type="button"
              >
                <Users className="size-4" /> View Upgrade Requests
              </button>
            </div>
          </div>

          {/* Organization subscription list */}
          <div className="rounded-xl border border-border bg-background">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-black">Organization Subscriptions</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {data.organizations.length} organizations · {data.packages.length} packages · {data.subscriptions.length} subscriptions
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Package</th>
                    <th className="px-5 py-3">Billing</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Started</th>
                    <th className="px-5 py-3">Expires</th>
                  </tr>
                </thead>
                <tbody>
                    {data.organizations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                        No organizations found
                      </td>
                    </tr>
                  ) : (
                    data.organizations.map((org: any) => {
                      const orgSub = data.subscriptions.find((s: any) => s.organization_id === org.id);
                      const pkg = orgSub ? data.packages.find((p: any) => p.id === orgSub.package_id) : null;
                      const billingCycle = orgSub?.billing_period ?? "—";
                      return (
                        <tr key={org.id} className="border-b border-border hover:bg-accent/5 transition-colors">
                          <td className="px-5 py-3">
                            <div>
                              <p className="font-semibold">{org.name}</p>
                              {org.billing_email && (
                                <p className="text-[11px] text-muted-foreground">{org.billing_email}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {pkg ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                {pkg.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500">
                                No plan
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {orgSub ? (
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize" suppressHydrationWarning>
                                {billingCycle === "annual" ? "Annual" : billingCycle === "monthly" ? "Monthly" : billingCycle === "custom" ? "Custom" : billingCycle}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={orgSub?.status ?? "unassigned"} />
                          </td>
                          <td className="px-5 py-3 text-muted-foreground" suppressHydrationWarning>
                            {orgSub?.started_at ? new Date(orgSub.started_at).toLocaleDateString("en-IN") : "-"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground" suppressHydrationWarning>
                            {orgSub?.expires_at ? new Date(orgSub.expires_at).toLocaleDateString("en-IN") : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === "packages" && <PackageManagementClient data={data} />}

      {/* Requests Tab */}
      {activeTab === "requests" && <RequestQueueClient />}
    </div>
  );
}

function StatusBadge({ status, suppressHydrationWarning }: { status: string; suppressHydrationWarning?: boolean }) {
  const colors: Record<string, string> = {
    active: "border-green-200 bg-green-50 text-green-700",
    trial: "border-blue-200 bg-blue-50 text-blue-700",
    expired: "border-red-200 bg-red-50 text-red-700",
    suspended: "border-orange-200 bg-orange-50 text-orange-800",
    cancelled: "border-slate-200 bg-slate-50 text-slate-700",
    inactive: "border-gray-200 bg-gray-50 text-gray-700",
    unassigned: "border-gray-200 bg-gray-50 text-gray-500",
  };
  const normalized = status?.toLowerCase() ?? "inactive";
  return (
    <span
      className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + (colors[normalized] ?? "border-border bg-surface-muted text-muted-foreground")}
      suppressHydrationWarning={suppressHydrationWarning}
    >
      {normalized}
    </span>
  );
}
