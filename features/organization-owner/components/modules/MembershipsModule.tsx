"use client";

import { useCallback, useState, useActionState } from "react";
import { Archive, Edit3, Plus } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { savePlanAction, setPlanStatusAction } from "@/features/organization-owner/actions/membership-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type MembershipsModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type PlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function MembershipsModule({ dashboard, moduleData }: MembershipsModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [state, formAction] = useActionState(savePlanAction, initialAuthActionState);

  const initialPlans = (moduleData?.items ?? dashboard.membershipPlans) as PlanRow[];
  const { items: plans, addOptimistic, updateOptimistic } = useOptimisticList<PlanRow>(initialPlans);

  const openCreate = useCallback(() => { setEditingPlan(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((p: PlanRow) => { setEditingPlan(p); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingPlan(null); }, []);
  const handleApplyFilters = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);

  const handleArchive = useCallback(async (planId: string) => {
    updateOptimistic(planId, { status: "archived" as never });
    const fd = new FormData(); fd.set("planId", planId); fd.set("status", "archived");
    const result = await setPlanStatusAction({ status: "idle", message: null } as never, fd);
    if (result.status !== "success") showToast(result.message || "Failed to archive", "error");
    else showToast("Plan archived", "success");
  }, [updateOptimistic]);

  const items = plans.map((plan) => ({
    id: plan.id, title: plan.name, subtitle: formatEnterpriseLabel(plan.plan_type),
    meta: `${formatCurrency(Number(plan.price_amount ?? 0), plan.currency)} · ${plan.duration_days ? `${Math.floor(plan.duration_days / 30)}mo` : "Flexible"}`,
    badge: plan.status,
    badgeVariant: (plan.status === "active" ? "success" : plan.status === "archived" ? "warning" : "neutral") as "success" | "warning" | "neutral",
    sections: [
      { label: "Price", value: formatCurrency(Number(plan.price_amount ?? 0), plan.currency) },
      { label: "Type", value: formatEnterpriseLabel(plan.plan_type) },
      { label: "Duration", value: plan.duration_days ? `${Math.floor(plan.duration_days / 30)}mo` : "Flexible" },
      { label: "Status", value: plan.status }
    ],
    actions: [
      { label: "Edit", onClick: () => openEdit(plan), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
      ...(plan.status === "active" ? [{ label: "Archive", onClick: () => handleArchive(plan.id), variant: "destructive" as const, icon: <Archive className="size-3.5" /> }] : [])
    ]
  }));

  const totalItems = moduleData?.items?.length ?? dashboard.membershipPlans.length;

  return (
    <div className="space-y-6">
      <FilterBar filterGroups={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }] }]} searchPlaceholder="Search plans..." onApply={handleApplyFilters} activeFilters={filters as unknown as unknown as Record<string, string>} />
      <DataList headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create Plan</Button>} headerTitle="Plans" items={items} totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
      <OrgOwnerDrawer description={editingPlan ? `Editing ${editingPlan.name}` : "Create a new plan"} onClose={closeDrawer} open={drawerOpen} title={editingPlan ? "Edit Plan" : "Create Plan"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingPlan ? <input name="planId" type="hidden" value={editingPlan.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required><select className={selectClass} defaultValue={editingPlan?.gym_id ?? ""} name="gymId" required><option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></DrawerField>
            <DrawerField label="Name" required><input className={selectClass} defaultValue={editingPlan?.name ?? ""} name="name" required type="text" /></DrawerField>
            <DrawerField label="Type" required><select className={selectClass} defaultValue={editingPlan?.plan_type ?? "monthly"} name="planType" required><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half Yearly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></DrawerField>
            <DrawerField label="Price" required><input className={selectClass} defaultValue={editingPlan?.price_amount ?? 0} min={0} name="priceAmount" required step="0.01" type="number" /></DrawerField>
            <DrawerField label="Currency"><input className={selectClass} defaultValue={editingPlan?.currency ?? "INR"} maxLength={3} name="currency" type="text" /></DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingPlan ? "Update" : "Create"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
