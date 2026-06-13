import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrgSubscriptionTable } from "@/features/super-admin/components/subscriptions/OrgSubscriptionTable";
import { SubscriptionAnalyticsCards } from "@/features/super-admin/components/subscriptions/SubscriptionAnalyticsCards";
import { SubscriptionRecentEvents } from "@/features/super-admin/components/subscriptions/SubscriptionRecentEvents";
import { getAllOrgsWithSubscriptions, getAllPackages } from "@/features/super-admin/services/subscription-service";
import { getSubscriptionAnalytics } from "@/features/super-admin/services/subscription-analytics-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";

export const metadata: Metadata = createMetadata({
  title: "Subscription Management",
  description: "Enterprise subscription lifecycle, analytics, usage monitoring, and package assignment across all tenant organizations.",
  path: "/super-admin/subscriptions",
});

async function safeData<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise; } catch { return fallback; }
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperAdminSubscriptionsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const context = await requireAuth("/super-admin/subscriptions");
  if (!context.roles.includes("super_admin")) redirect("/unauthorized");
  await requireRole(["super_admin"], "/super-admin/subscriptions");

  const [organizations, packages, rawAnalytics, recentEvents] = await Promise.all([
    safeData(getAllOrgsWithSubscriptions(), [] as Awaited<ReturnType<typeof getAllOrgsWithSubscriptions>>),
    safeData(getAllPackages(), [] as Awaited<ReturnType<typeof getAllPackages>>),
    safeData(getSubscriptionAnalytics(), null),
    safeData(getRecentGlobalEvents(), [] as RecentEvent[]),
  ]);

  const analytics = rawAnalytics ?? {
    totalOrganizations: organizations.length,
    activeSubscriptions: 0, trialingSubscriptions: 0, expiredSubscriptions: 0,
    suspendedSubscriptions: 0, cancelledSubscriptions: 0, unassigned: 0,
    activeChange: 0, trialConversionRate: 0, mrr: 0, arr: 0,
    revenueByPlan: [], addonMrr: 0, totalAddonMrr: 0,
    recentEvents: [], subscriptionsOverMemberLimit: 0, subscriptionsOverBranchLimit: 0,
  };

  const searchQuery = (params.q ?? "").toString().toLowerCase().trim();
  const statusFilter = (params.status ?? "").toString().split(",").map((s) => s.trim()).filter(Boolean);
  const sortBy = (params.sort ?? "name").toString();

  let filteredOrgs = organizations;
  if (statusFilter.length > 0) {
    filteredOrgs = filteredOrgs.filter((o) => statusFilter.includes(o.status ?? "unassigned"));
  }
  if (searchQuery) {
    filteredOrgs = filteredOrgs.filter(
      (o) =>
        o.organizationName.toLowerCase().includes(searchQuery) ||
        (o.organizationContact ?? "").toLowerCase().includes(searchQuery),
    );
  }
  if (sortBy === "status") {
    filteredOrgs.sort((a, b) => (a.status ?? "unassigned").localeCompare(b.status ?? "unassigned"));
  } else if (sortBy === "plan") {
    filteredOrgs.sort((a, b) => (a.packageName ?? "Unassigned").localeCompare(b.packageName ?? "Unassigned"));
  } else {
    filteredOrgs.sort((a, b) => a.organizationName.localeCompare(b.organizationName));
  }

  const assignedCount = organizations.filter((o) => o.subscriptionId).length;
  const unassignedCount = organizations.length - assignedCount;

  return (
    <div id="main-content" className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Subscription Management</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Enterprise SaaS subscription lifecycle, plan assignment, usage monitoring, analytics, and billing operations across all tenant organizations.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/super-admin/subscriptions/export"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-surface-muted"
          >
            <Download className="size-4" />
            Export CSV
          </a>
        </div>
      </section>

      <SubscriptionAnalyticsCards analytics={analytics} />

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Building2 className="size-5 text-accent" />}
          label="Total Organizations"
          value={analytics.totalOrganizations.toLocaleString("en-IN")}
          detail="In platform scope"
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-5 text-green-600" />}
          label="Assigned"
          value={assignedCount.toLocaleString("en-IN")}
          detail={`${analytics.activeSubscriptions} active · ${analytics.trialingSubscriptions} trialing`}
        />
        <SummaryCard
          icon={<XCircle className="size-5 text-red-600" />}
          label="Unassigned / At Risk"
          value={unassignedCount.toLocaleString("en-IN")}
          detail={`${unassignedCount} unassigned · ${analytics.suspendedSubscriptions} suspended · ${analytics.expiredSubscriptions} expired`}
        />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-xl font-black sm:text-2xl">Organizations</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <form method="GET" action="/super-admin/subscriptions" className="w-full sm:w-auto">
                  <input
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Search organizations..."
                    className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm shadow-sm sm:w-56"
                    aria-label="Search organizations"
                  />
                </form>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <select
                  name="status"
                  className="h-10 flex-1 sm:flex-none rounded-md border border-border bg-surface px-3 text-sm"
                  defaultValue={params.status?.toString() ?? ""}
                  onChange={(e) => {
                    const url = new URL(window.location.href);
                    if (e.target.value) url.searchParams.set("status", e.target.value);
                    else url.searchParams.delete("status");
                    window.location.href = url.toString();
                  }}
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  name="sort"
                  className="h-10 flex-1 sm:flex-none rounded-md border border-border bg-surface px-3 text-sm"
                  defaultValue={sortBy}
                  onChange={(e) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("sort", e.target.value);
                    window.location.href = url.toString();
                  }}
                  aria-label="Sort by"
                >
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                  <option value="plan">Plan</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OrgSubscriptionTable organizations={filteredOrgs} packages={packages} />
          {filteredOrgs.length === 0 && (
            <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
              No organizations match the current filters.
            </p>
          )}
        </CardContent>
      </Card>

      {recentEvents.length > 0 && (
        <SubscriptionRecentEvents events={recentEvents} />
      )}

      <Card>
        <CardHeader>
          <h2 className="text-xl font-black sm:text-2xl">Revenue by Plan</h2>
        </CardHeader>
        <CardContent>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Subscriptions</th>
                  <th className="px-4 py-3">MRR</th>
                  <th className="px-4 py-3">% of Total MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analytics.revenueByPlan.map((plan) => {
                  const pct = analytics.mrr > 0 ? Math.round((plan.mrr / analytics.mrr) * 100) : 0;
                  return (
                    <tr key={plan.planName} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-bold">{plan.planName}</td>
                      <td className="px-4 py-3">{plan.count}</td>
                      <td className="px-4 py-3 font-black">{formatCurrency(plan.mrr, "INR")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-black">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3">{analytics.activeSubscriptions + analytics.trialingSubscriptions}</td>
                  <td className="px-4 py-3">{formatCurrency(analytics.mrr, "INR")}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="space-y-3 sm:hidden">
            {analytics.revenueByPlan.map((plan) => {
              const pct = analytics.mrr > 0 ? Math.round((plan.mrr / analytics.mrr) * 100) : 0;
              return (
                <div key={plan.planName} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold">{plan.planName}</span>
                    <span className="text-xs font-black">{formatCurrency(plan.mrr, "INR")}/mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold">{pct}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.count} subscription{plan.count !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
            <div className="rounded-lg border-2 border-border bg-surface-muted p-3">
              <div className="flex items-center justify-between">
                <span className="font-black">Total</span>
                <span className="font-black">{formatCurrency(analytics.mrr, "INR")}/mo</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{analytics.activeSubscriptions + analytics.trialingSubscriptions} subscriptions</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 shrink-0 text-green-600" />
              <span className="font-semibold">MRR: {formatCurrency(analytics.mrr, "INR")}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 shrink-0 text-accent" />
              <span className="font-semibold">ARR: {formatCurrency(analytics.arr, "INR")}</span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="size-4 shrink-0 text-blue-600" />
              <span className="font-semibold">Trial conversion: {analytics.trialConversionRate}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {(analytics.subscriptionsOverMemberLimit > 0 || analytics.subscriptionsOverBranchLimit > 0) && (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-4 text-sm">
          <p className="font-semibold text-muted-foreground">
            {analytics.subscriptionsOverMemberLimit > 0 && (
              <span className="mr-4 text-red-600">
                <AlertTriangle className="mr-1 inline size-4" />
                {analytics.subscriptionsOverMemberLimit} org(s) over member limit
              </span>
            )}
            {analytics.subscriptionsOverBranchLimit > 0 && (
              <span className="text-red-600">
                <AlertTriangle className="mr-1 inline size-4" />
                {analytics.subscriptionsOverBranchLimit} org(s) over branch limit
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

type RecentEvent = {
  id: string;
  organization_id: string;
  event_type: string;
  reason: string | null;
  created_at: string;
};

async function getRecentGlobalEvents(): Promise<RecentEvent[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const client = supabase as never as {
      from(t: string): {
        select(c: string): {
          order(c: string, o: { ascending: boolean }): {
            limit(n: number): Promise<{ data: RecentEvent[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data } = await client
      .from("subscription_events")
      .select("")
      .order("created_at", { ascending: false })
      .limit(10);
    return data ?? [];
  } catch {
    return [];
  }
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-black text-muted-foreground">{label}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-black">{value}</p>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
