"use client";

import { useCallback, useState, useActionState } from "react";
import { Globe2, Plus, Trash2 } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { addDomainAction, removeDomainAction } from "@/features/organization-owner/actions/domain-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { showToast } from "@/components/ui/toast";
import { StatCard } from "@/components/ui/stat-card";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type DomainsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type DomainRow = Database["public"]["Tables"]["tenant_domains"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function DomainsEnterpriseModule({ dashboard, moduleData }: DomainsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction] = useActionState(addDomainAction, initialAuthActionState);

  const initial = (moduleData?.items ?? dashboard.tenantDomains) as DomainRow[];
  const { items: domains, addOptimistic, removeOptimistic } = useOptimisticList<DomainRow>(initial);

  const openCreate = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleRemove = useCallback(async (domainId: string) => {
    removeOptimistic(domainId);
    const fd = new FormData(); fd.set("domainId", domainId);
    const r = await removeDomainAction({ status: "idle", message: null } as never, fd);
    if (r.status !== "success") showToast(r.message || "Failed", "error");
    else showToast("Domain removed", "success");
  }, [removeOptimistic]);

  const items = domains.map((d) => ({
    id: d.id, title: d.domain, subtitle: `${formatEnterpriseLabel(d.domain_type)} · ${formatEnterpriseLabel(d.routing_mode)}`,
    meta: `SSL: ${d.ssl_status ? formatEnterpriseLabel(d.ssl_status) : "N/A"}`,
    badge: d.status, badgeVariant: (d.status === "verified" ? "success" : "warning") as "success" | "warning",
    sections: [{ label: "Type", value: formatEnterpriseLabel(d.domain_type) }, { label: "SSL", value: d.ssl_status ? formatEnterpriseLabel(d.ssl_status) : "—" }, { label: "Primary", value: d.is_primary ? "Yes" : "No" }],
    actions: [{ label: "Remove", onClick: () => handleRemove(d.id), variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> }]
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Custom domains" icon={<Globe2 className="size-5" />} label="Domains" value={String(domains.length)} />
        <StatCard detail="Verified" icon={<Globe2 className="size-5" />} label="Verified" value={String(domains.filter((d) => d.status === "verified").length)} />
        <StatCard detail="Primary" icon={<Globe2 className="size-5" />} label="Primary" value={String(domains.filter((d) => d.is_primary).length)} />
        <StatCard detail="Provider events" icon={<Globe2 className="size-5" />} label="Events" value={String(dashboard.tenantDomainProviderEvents.length)} />
      </section>
      <DataList headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Domain</Button>} headerTitle="Domains" items={items} totalItems={domains.length} totalPages={Math.ceil(domains.length / 12)} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
      <OrgOwnerDrawer description="Add a custom domain" onClose={closeDrawer} open={drawerOpen} title="Add Domain" size="md">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <DrawerField label="Domain" required><input className={selectClass} name="domain" placeholder="gym.example.com" required type="text" /></DrawerField>
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Type"><select className={selectClass} defaultValue="custom_domain" name="domainType"><option value="custom_domain">Custom</option><option value="subdomain">Subdomain</option></select></DrawerField>
            <DrawerField label="Routing"><select className={selectClass} defaultValue="organization" name="routingMode"><option value="organization">Organization</option><option value="branch">Branch</option></select></DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Add</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
