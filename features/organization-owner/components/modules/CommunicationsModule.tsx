"use client";

import { useCallback, useState, useActionState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveCampaignAction } from "@/features/organization-owner/actions/communication-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type CommunicationsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function CommunicationsEnterpriseModule({ dashboard, moduleData }: CommunicationsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction] = useActionState(saveCampaignAction, initialAuthActionState);
  const openCreate = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);

  const campaigns = (moduleData?.items ?? dashboard.campaigns) as CampaignRow[];
  const items = campaigns.map((c) => ({
    id: c.id, title: c.name, subtitle: formatEnterpriseLabel(c.campaign_type),
    meta: `Segment: ${c.segment_key} · ${new Date(c.created_at).toLocaleDateString("en-IN")}`,
    badge: c.status, badgeVariant: (c.status === "running" ? "success" : c.status === "draft" ? "neutral" : "warning") as "success" | "neutral" | "warning",
    sections: [{ label: "Type", value: formatEnterpriseLabel(c.campaign_type) }, { label: "Category", value: formatEnterpriseLabel(c.category) }, { label: "Status", value: c.status }]
  }));
  const totalItems = moduleData?.items?.length ?? dashboard.campaigns.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total notifications" icon={<MessageSquare className="size-5" />} label="Notifications" value={String(dashboard.notifications.length)} />
        <StatCard detail="Unread" icon={<MessageSquare className="size-5" />} label="Unread" value={String(dashboard.notifications.filter((n) => n.status === "unread").length)} />
        <StatCard detail="Campaigns" icon={<MessageSquare className="size-5" />} label="Campaigns" value={String(campaigns.length)} />
        <StatCard detail="Running or scheduled" icon={<MessageSquare className="size-5" />} label="Running" value={String(campaigns.filter((c) => c.status === "running" || c.status === "scheduled").length)} />
      </section>
      <FilterBar filterGroups={[{ key: "status", label: "Status", options: [{ value: "draft", label: "Draft" }, { value: "running", label: "Running" }] }]} searchPlaceholder="Search campaigns..." onApply={handleApply} activeFilters={filters as unknown as unknown as Record<string, string>} />
      <DataList headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create</Button>} headerTitle="Campaigns" items={items} totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
      <OrgOwnerDrawer description="Create a campaign" onClose={closeDrawer} open={drawerOpen} title="Create Campaign" size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required><select className={selectClass} defaultValue="" name="gymId" required><option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></DrawerField>
            <DrawerField label="Name" required><input className={selectClass} name="name" required type="text" /></DrawerField>
            <DrawerField label="Type" required><select className={selectClass} defaultValue="email" name="campaignType" required><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select></DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Create</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
