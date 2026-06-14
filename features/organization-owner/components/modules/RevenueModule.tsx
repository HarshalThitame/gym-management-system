"use client";

import { useCallback, useState } from "react";
import { CreditCard, ReceiptText } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { StatCard } from "@/components/ui/stat-card";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";

type RevenueEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function RevenueEnterpriseModule({ dashboard, moduleData }: RevenueEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, dateFrom: f.dateFrom, dateTo: f.dateTo }); }, [navigate]);

  const payments = (moduleData?.items ?? dashboard.payments) as typeof dashboard.payments;
  const paid = payments.filter((p) => p.status === "paid");
  const totalCollected = paid.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const items = payments.map((p) => ({
    id: p.id, title: p.payment_number, subtitle: formatCurrency(Number(p.amount ?? 0), p.currency),
    meta: `${p.payment_type} · ${p.method} · ${new Date(p.created_at).toLocaleDateString("en-IN")}`,
    badge: p.status, badgeVariant: (p.status === "paid" ? "success" : p.status === "failed" ? "error" : "warning") as "success" | "error" | "warning",
    sections: [
      { label: "Amount", value: formatCurrency(Number(p.amount ?? 0), p.currency) },
      { label: "Type", value: p.payment_type }, { label: "Method", value: p.method },
      { label: "Date", value: new Date(p.created_at).toLocaleDateString("en-IN") }
    ]
  }));

  const totalItems = moduleData?.items?.length ?? dashboard.payments.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total collected" icon={<CreditCard className="size-5" />} label="Collected" value={formatCurrency(totalCollected)} />
        <StatCard detail="Paid transactions" icon={<ReceiptText className="size-5" />} label="Paid" value={String(dashboard.metrics.paidPayments)} />
        <StatCard detail="Failed attempts" icon={<CreditCard className="size-5" />} label="Failed" value={String(dashboard.metrics.failedPayments)} />
        <StatCard detail="Branch metric revenue" icon={<CreditCard className="size-5" />} label="Revenue" value={formatCurrency(dashboard.metrics.totalRevenue)} />
      </section>
      <FilterBar filterGroups={[{ key: "status", label: "Status", options: [{ value: "paid", label: "Paid" }, { value: "pending", label: "Pending" }, { value: "failed", label: "Failed" }, { value: "refunded", label: "Refunded" }] }]} searchPlaceholder="Search by payment number..." onApply={handleApply} activeFilters={filters as unknown as unknown as Record<string, string>} />
      <DataList headerTitle="Payments" items={items} totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
    </div>
  );
}
