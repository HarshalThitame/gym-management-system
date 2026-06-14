"use client";

import { useCallback, useState, useActionState } from "react";
import { Palette, Plus } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveBrandingAction } from "@/features/organization-owner/actions/branding-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";

type BrandingEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function BrandingEnterpriseModule({ dashboard, moduleData }: BrandingEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction] = useActionState(saveBrandingAction, initialAuthActionState);
  const openCreate = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const configs = (moduleData?.items ?? dashboard.tenantConfigs) as typeof dashboard.tenantConfigs;
  const items = configs.map((c) => ({
    id: c.id, title: c.brand_name, subtitle: c.tenant_key, meta: `${c.custom_domain ?? c.subdomain ?? "No domain"}`,
    badge: c.status, badgeVariant: (c.status === "active" ? "success" : "neutral") as "success" | "neutral",
    sections: [{ label: "Primary", value: c.primary_color ?? "—" }, { label: "Secondary", value: c.secondary_color ?? "—" }, { label: "Domain", value: c.custom_domain ?? c.subdomain ?? "—" }, { label: "Status", value: c.status }]
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Brand profiles" icon={<Palette className="size-5" />} label="Brands" value={String(configs.length)} />
        <StatCard detail="Active" icon={<Palette className="size-5" />} label="Active" value={String(configs.filter((c) => c.status === "active").length)} />
        <StatCard detail="Custom domains" icon={<Palette className="size-5" />} label="Domain" value={String(dashboard.tenantDomains.filter((d) => d.domain_type === "custom_domain").length)} />
        <StatCard detail="Feature overrides" icon={<Palette className="size-5" />} label="Flags" value={String(dashboard.featureFlags.length)} />
      </section>
      <DataList headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Brand</Button>} headerTitle="Brands" items={items} totalItems={configs.length} totalPages={Math.ceil(configs.length / 12)} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
      <OrgOwnerDrawer description="Add a brand" onClose={closeDrawer} open={drawerOpen} title="Add Brand" size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <DrawerField label="Brand Name" required><input className={selectClass} name="brandName" required type="text" /></DrawerField>
          <div className="grid gap-5 md:grid-cols-3">
            <DrawerField label="Primary"><input className={selectClass} name="primaryColor" placeholder="#FF0000" type="text" /></DrawerField>
            <DrawerField label="Secondary"><input className={selectClass} name="secondaryColor" placeholder="#00FF00" type="text" /></DrawerField>
            <DrawerField label="Accent"><input className={selectClass} name="accentColor" placeholder="#0000FF" type="text" /></DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Save</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
