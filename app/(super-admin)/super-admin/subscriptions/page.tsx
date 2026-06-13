import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAllOrgsWithSubscriptions, getAllPackages } from "@/features/super-admin/services/subscription-service";
import { getSubscriptionAnalytics } from "@/features/super-admin/services/subscription-analytics-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";

export const metadata: Metadata = createMetadata({
  title: "Subscription Management",
  description: "Enterprise subscription lifecycle management.",
  path: "/super-admin/subscriptions",
});

async function safeData<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise; } catch { return fallback; }
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
      </section>

      <p>Data loaded: {organizations.length} organizations, {packages.length} packages</p>
    </div>
  );
}
