"use client";

import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { CreditCard, ReceiptText, Gauge } from "lucide-react";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type BillingEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function BillingEnterpriseModule({ dashboard, moduleData }: BillingEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const subscriptions = (moduleData?.items ?? dashboard.subscriptions) as typeof dashboard.subscriptions;
  const items = subscriptions.map((s) => ({
    id: s.id, title: formatEnterpriseLabel(s.plan_tier), subtitle: `Starts: ${s.starts_on ? new Date(s.starts_on).toLocaleDateString("en-IN") : "N/A"}`,
    meta: `Renews: ${s.renews_on ? new Date(s.renews_on).toLocaleDateString("en-IN") : "Not scheduled"}`,
    badge: s.status, badgeVariant: (s.status === "active" ? "success" : s.status === "trial" ? "info" : "warning") as "success" | "info" | "warning",
    sections: [{ label: "Plan", value: formatEnterpriseLabel(s.plan_tier) }, { label: "Status", value: s.status }, { label: "Starts", value: s.starts_on ? new Date(s.starts_on).toLocaleDateString("en-IN") : "—" }, { label: "Renews", value: s.renews_on ? new Date(s.renews_on).toLocaleDateString("en-IN") : "—" }]
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Billing records" icon={<ReceiptText className="size-5" />} label="Subscriptions" value={String(subscriptions.length)} />
        <StatCard detail="Active or trial" icon={<CreditCard className="size-5" />} label="Active" value={String(dashboard.metrics.activeSubscriptions)} />
        <StatCard detail="Paid payments" icon={<CreditCard className="size-5" />} label="Paid" value={String(dashboard.metrics.paidPayments)} />
        <StatCard detail="Storage" icon={<Gauge className="size-5" />} label="Storage" value={`${formatCompactNumber(dashboard.metrics.storageMb)} MB`} />
      </section>
      <DataList headerTitle="Subscriptions" items={items} totalItems={subscriptions.length} totalPages={Math.ceil(subscriptions.length / 12)} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
    </div>
  );
}
