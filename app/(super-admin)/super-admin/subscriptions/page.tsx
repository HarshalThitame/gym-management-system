import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrgSubscriptionTable } from "@/features/super-admin/components/subscriptions/OrgSubscriptionTable";
import { getAllOrgsWithSubscriptions, getAllPackages } from "@/features/super-admin/services/subscription-service";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Subscription Management",
  description: "Assign SaaS package tiers to tenant organizations and review subscription status across the platform.",
  path: "/super-admin/subscriptions"
});

type SuperAdminSubscriptionsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function SuperAdminSubscriptionsPage({ searchParams }: SuperAdminSubscriptionsPageProps) {
  const params = searchParams ? await searchParams : {};
  const context = await requireAuth("/super-admin/subscriptions");

  if (!context.roles.includes("super_admin")) {
    redirect("/unauthorized");
  }

  await requireRole(["super_admin"], "/super-admin/subscriptions");

  const [organizations, packages] = await Promise.all([
    getAllOrgsWithSubscriptions(),
    getAllPackages()
  ]);
  const statuses = (params.status ?? "")
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  const filteredOrganizations = statuses.length > 0
    ? organizations.filter((organization) => statuses.includes(organization.status ?? "unassigned"))
    : organizations;
  const assignedOrganizations = organizations.filter((organization) => organization.subscriptionId).length;
  const unassignedOrganizations = organizations.length - assignedOrganizations;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Subscription Management</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            View every tenant organization, confirm its current SaaS package, and assign or change package access from one controlled console.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard detail="Tenant organizations in platform scope" label="Organizations" value={organizations.length.toLocaleString("en-IN")} />
        <SummaryCard detail="Organizations with a package row" label="Assigned" value={assignedOrganizations.toLocaleString("en-IN")} />
        <SummaryCard detail="Organizations still blocked by no package" label="Unassigned" value={unassignedOrganizations.toLocaleString("en-IN")} />
      </section>

      <OrgSubscriptionTable organizations={filteredOrganizations} packages={packages} />
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-black text-muted-foreground">{label}</p>
          <CreditCard aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-black">{value}</p>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
