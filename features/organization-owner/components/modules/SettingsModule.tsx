"use client";

import { useCallback } from "react";
import { Gauge, Palette, Settings, ShieldCheck } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";

type SettingsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function SettingsEnterpriseModule({ dashboard, moduleData }: SettingsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q }); }, [navigate]);
  const flags = (moduleData?.items ?? dashboard.featureFlags) as typeof dashboard.featureFlags;
  const items = flags.map((f) => ({
    id: f.id, title: f.name, subtitle: f.flag_key, meta: `Rollout: ${f.rollout_percentage ?? 0}% · ${f.enabled ? "Enabled" : "Disabled"}`,
    badge: f.status, badgeVariant: (f.status === "active" ? "success" : "neutral") as "success" | "neutral",
    sections: [{ label: "Key", value: f.flag_key }, { label: "Enabled", value: f.enabled ? "Yes" : "No" }, { label: "Rollout", value: `${f.rollout_percentage ?? 0}%` }, { label: "Status", value: f.status }]
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Branch settings" icon={<Settings className="size-5" />} label="Settings" value={String(dashboard.branchSettings.length)} />
        <StatCard detail="Feature flags" icon={<Gauge className="size-5" />} label="Flags" value={String(flags.length)} />
        <StatCard detail="Compliance requests" icon={<ShieldCheck className="size-5" />} label="Compliance" value={String(dashboard.complianceRequests.length)} />
        <StatCard detail="Config records" icon={<Palette className="size-5" />} label="Configs" value={String(dashboard.tenantConfigs.length)} />
      </section>
      <FilterBar searchPlaceholder="Search feature flags..." onApply={handleApply} activeFilters={filters as unknown as unknown as Record<string, string>} />
      <DataList headerTitle="Feature Flags" items={items} totalItems={flags.length} totalPages={Math.ceil(flags.length / 12)} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
    </div>
  );
}
