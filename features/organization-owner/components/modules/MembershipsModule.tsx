"use client";

import { useCallback, useState, useActionState } from "react";
import { Archive, CreditCard, Download, Edit3, Eye, Plus, Tags, TrendingUp, UsersRound } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { savePlanAction, setPlanStatusAction } from "@/features/organization-owner/actions/membership-actions";
import { bulkArchivePlansAction } from "@/features/organization-owner/actions/bulk-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCurrency, formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type MembershipsModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type PlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function MembershipsModule({ dashboard, moduleData }: MembershipsModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [detailPlan, setDetailPlan] = useState<PlanRow | null>(null);
  const [state, formAction] = useActionState(savePlanAction, initialAuthActionState);

  const initialPlans = (moduleData?.items ?? dashboard.membershipPlans) as PlanRow[];
  const { items: plans, addOptimistic, updateOptimistic } = useOptimisticList<PlanRow>(initialPlans);

  // ── KPIs ──
  const activePlans = plans.filter((p) => p.status === "active").length;
  const archivedPlans = plans.filter((p) => p.status === "archived" || p.status === "draft").length;
  const totalMemberships = dashboard.memberships.length;
  const activeMemberships = dashboard.memberships.filter((m) => m.status === "active").length;
  const totalPlanRevenue = plans.reduce((s, p) => {
    const count = dashboard.memberships.filter((m) => m.status === "active" && (m as unknown as { membership_plan_id: string }).membership_plan_id === p.id).length;
    return s + Number(p.price_amount ?? 0) * count;
  }, 0);

  const openCreate = useCallback(() => { setEditingPlan(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((p: PlanRow) => { setEditingPlan(p); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingPlan(null); }, []);
  const handleApplyFilters = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, gymId: f.gymId }); }, [navigate]);

  const handleArchive = useCallback(async (planId: string) => {
    updateOptimistic(planId, { status: "archived" as never });
    const fd = new FormData(); fd.set("planId", planId); fd.set("status", "archived");
    const result = await setPlanStatusAction({ status: "idle", message: null } as never, fd);
    if (result.status !== "success") showToast(result.message || "Failed", "error");
    else showToast("Plan archived", "success");
  }, [updateOptimistic]);

  const items = plans.map((plan) => {
    const gym = dashboard.gyms.find((g) => g.id === plan.gym_id);
    const memberCount = dashboard.memberships.filter((m) => (m as unknown as { membership_plan_id: string }).membership_plan_id === plan.id).length;
    const activeOnPlan = dashboard.memberships.filter((m) => m.status === "active" && (m as unknown as { membership_plan_id: string }).membership_plan_id === plan.id).length;
    const planRevenue = Number(plan.price_amount ?? 0) * activeOnPlan;

    return {
      id: plan.id,
      title: plan.name,
      subtitle: `${gym?.name ?? "All gyms"} · ${formatEnterpriseLabel(plan.plan_type)}`,
      meta: `${formatCurrency(Number(plan.price_amount ?? 0), plan.currency)}${plan.joining_fee_amount ? ` + ${formatCurrency(Number(plan.joining_fee_amount), plan.currency)} joining` : ""} · ${plan.duration_days ? `${Math.floor(plan.duration_days / 30)}mo` : "Flexible duration"}`,
      badge: plan.status,
      badgeVariant: (plan.status === "active" ? "success" : plan.status === "archived" ? "warning" : "neutral") as "success" | "warning" | "neutral",
      status: plan.status,
      sections: [
        { label: "Price", value: formatCurrency(Number(plan.price_amount ?? 0), plan.currency) },
        { label: "Access", value: formatEnterpriseLabel(plan.access_level ?? "gym") },
        { label: "Members", value: `${activeOnPlan} active · ${memberCount} total` },
        { label: "Revenue", value: formatCurrency(planRevenue) },
      ],
      actions: [
        { label: "Details", onClick: () => setDetailPlan(plan), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        { label: "Edit", onClick: () => openEdit(plan), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
        ...(plan.status === "active"
          ? [{ label: "Archive", onClick: () => handleArchive(plan.id), variant: "destructive" as const, icon: <Archive className="size-3.5" /> }]
          : [])
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? dashboard.membershipPlans.length;

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total membership plans across all gyms" icon={<Tags className="size-5" />} label="Total Plans" value={String(plans.length)} />
        <StatCard detail="Published active plans" icon={<Tags className="size-5" />} label="Active Plans" value={String(activePlans)} />
        <StatCard detail="Total membership subscriptions" icon={<UsersRound className="size-5" />} label="Memberships" value={formatCompactNumber(totalMemberships)} />
        <StatCard detail="Active membership subscriptions" icon={<CreditCard className="size-5" />} label="Active Memberships" value={formatCompactNumber(activeMemberships)} />
        <StatCard detail="Monthly recurring revenue from active plans" icon={<TrendingUp className="size-5" />} label="MRR" value={formatCurrency(totalPlanRevenue)} />
        <StatCard detail="Archived or draft plans" icon={<Archive className="size-5" />} label="Archived" value={String(archivedPlans)} />
      </section>

      {/* ═══ FILTERS ═══ */}
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "archived", label: "Archived" }, { value: "draft", label: "Draft" }
          ]},
          { key: "gymId", label: "Gym", options: [
            { value: "all", label: "All Gyms" },
            ...dashboard.gyms.map((g) => ({ value: g.id, label: g.name }))
          ]}
        ]}
        searchPlaceholder="Search plans by name or type..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as Record<string, string>}
      />

      {/* ═══ DATA LIST ═══ */}
      <DataList
        selectable
        bulkActions={[
          { label: "Archive", onClick: async (ids) => { const fd = new FormData(); fd.set("planIds", ids.join(",")); const r = await bulkArchivePlansAction({ status: "idle" }, fd); showToast(r.message || "Done", r.status === "success" ? "success" : "error"); ids.forEach((id) => updateOptimistic(id, { status: "archived" as never })); }, variant: "destructive" as const, icon: <Archive className="size-3.5" /> },
          { label: "Export CSV", onClick: (ids) => { const data = plans.filter((p) => ids.includes(p.id)).map((p) => ({ name: p.name, type: p.plan_type, price: p.price_amount, currency: p.currency, duration_days: p.duration_days, status: p.status })); exportToCSV(data, "plans-selected"); }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(plans.map((p) => ({ name: p.name, type: p.plan_type, price: p.price_amount, currency: p.currency, access_level: p.access_level, duration_days: p.duration_days, status: p.status })), "all-plans")}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create Plan</Button>}
        headerTitle="Plans" items={items}
        totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description={editingPlan ? `Editing ${editingPlan.name}` : "Create a new plan"} onClose={closeDrawer} open={drawerOpen} title={editingPlan ? "Edit Plan" : "Create Plan"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingPlan ? <input name="planId" type="hidden" value={editingPlan.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required>
              <select className={selectClass} defaultValue={editingPlan?.gym_id ?? ""} name="gymId" required>
                <option value="">Select gym</option>
                {dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Plan Name" required>
              <input className={selectClass} defaultValue={editingPlan?.name ?? ""} name="name" required type="text" placeholder="Gold Monthly" />
            </DrawerField>
            <DrawerField label="Type" required>
              <select className={selectClass} defaultValue={editingPlan?.plan_type ?? "monthly"} name="planType" required>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half Yearly</option><option value="annual">Annual</option><option value="custom">Custom</option>
              </select>
            </DrawerField>
            <DrawerField label="Access Level">
              <select className={selectClass} defaultValue={editingPlan?.access_level ?? "gym"} name="accessLevel">
                <option value="gym">Single Gym</option><option value="multi_gym">Multi Gym</option>
                <option value="organization">Organization</option><option value="franchise">Franchise</option>
              </select>
            </DrawerField>
            <DrawerField label="Price" required>
              <input className={selectClass} defaultValue={editingPlan?.price_amount ?? 0} min={0} name="priceAmount" required step="0.01" type="number" />
            </DrawerField>
            <DrawerField label="Joining Fee">
              <input className={selectClass} defaultValue={editingPlan?.joining_fee_amount ?? 0} min={0} name="joiningFee" step="0.01" type="number" />
            </DrawerField>
            <DrawerField label="Currency">
              <input className={selectClass} defaultValue={editingPlan?.currency ?? "INR"} maxLength={3} name="currency" type="text" />
            </DrawerField>
            <DrawerField label="Duration (months)">
              <input className={selectClass} defaultValue={editingPlan?.duration_days ? Math.floor(editingPlan.duration_days / 30) : 1} min={1} name="durationMonths" type="number" />
            </DrawerField>
            <div className="md:col-span-2">
              <DrawerField label="Description">
                <textarea className={`${selectClass} min-h-[80px]`} defaultValue={editingPlan?.description ?? ""} name="description" placeholder="Describe what this plan includes..." rows={3} />
              </DrawerField>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingPlan ? "Update Plan" : "Create Plan"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ DETAIL PANEL ═══ */}
      {detailPlan ? <PlanDetailPanel plan={detailPlan} dashboard={dashboard} onClose={() => setDetailPlan(null)} /> : null}
    </div>
  );
}

/* ─── Detail Panel ─── */
function PlanDetailPanel({ plan, dashboard, onClose }: { plan: PlanRow; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
  const gym = dashboard.gyms.find((g) => g.id === plan.gym_id);
  const memberships = dashboard.memberships.filter((m) => (m as unknown as { membership_plan_id: string }).membership_plan_id === plan.id);
  const activeOnPlan = memberships.filter((m) => m.status === "active");
  const planRevenue = Number(plan.price_amount ?? 0) * activeOnPlan.length;
  const members = dashboard.members.filter((m) => memberships.some((ms) => ms.member_id === m.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${plan.name} details`}>
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{plan.name}</h2>
              <EnterpriseStatusBadge status={plan.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{formatEnterpriseLabel(plan.plan_type)} · {formatCurrency(Number(plan.price_amount ?? 0), plan.currency)}{plan.joining_fee_amount ? ` + ${formatCurrency(Number(plan.joining_fee_amount), plan.currency)} joining` : ""}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Tags className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary */}
          <Card>
            <CardHeader><h3 className="text-lg font-black">Summary</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Gym</p><p className="text-sm font-bold">{gym?.name ?? "All gyms"}</p></div>
              <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{formatEnterpriseLabel(plan.plan_type)}</p></div>
              <div><p className="text-xs text-muted-foreground">Price</p><p className="text-sm font-bold">{formatCurrency(Number(plan.price_amount ?? 0), plan.currency)}</p></div>
              <div><p className="text-xs text-muted-foreground">Joining Fee</p><p className="text-sm font-bold">{plan.joining_fee_amount ? formatCurrency(Number(plan.joining_fee_amount), plan.currency) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Duration</p><p className="text-sm font-bold">{plan.duration_days ? `${Math.floor(plan.duration_days / 30)} months` : "Flexible"}</p></div>
              <div><p className="text-xs text-muted-foreground">Access Level</p><p className="text-sm font-bold">{formatEnterpriseLabel(plan.access_level ?? "gym")}</p></div>
              <div><p className="text-xs text-muted-foreground">Display Order</p><p className="text-sm font-bold">{plan.display_order ?? 0}</p></div>
              <div><p className="text-xs text-muted-foreground">Public</p><p className="text-sm font-bold">{plan.is_public ? "Yes" : "No"}</p></div>
            </CardContent>
          </Card>

          {/* Description */}
          {plan.description ? (
            <Card>
              <CardHeader><h3 className="text-lg font-black">Description</h3></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{plan.description}</p></CardContent>
            </Card>
          ) : null}

          {/* Analytics */}
          <Card>
            <CardHeader><h3 className="text-lg font-black">Analytics</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Active Members</p>
                <p className="mt-1 text-2xl font-black">{activeOnPlan.length}</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total Memberships</p>
                <p className="mt-1 text-2xl font-black">{memberships.length}</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                <p className="mt-1 text-2xl font-black">{formatCurrency(planRevenue)}</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Features</p>
                <p className="mt-1 text-2xl font-black">{plan.features ? "Custom" : "Standard"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Members on this plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">Members on this Plan</h3>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{activeOnPlan.length} active</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members on this plan yet.</p>
              ) : memberships.slice(0, 10).map((ms) => {
                const member = dashboard.members.find((m) => m.id === ms.member_id);
                return (
                  <div key={ms.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                        {member?.full_name?.charAt(0) ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{member?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{member?.member_code ?? ""} · {ms.start_date ? new Date(ms.start_date).toLocaleDateString("en-IN") : "—"} → {ms.end_date ? new Date(ms.end_date).toLocaleDateString("en-IN") : "—"}</p>
                      </div>
                    </div>
                    <EnterpriseStatusBadge status={ms.status} />
                  </div>
                );
              })}
              {memberships.length > 10 ? <p className="text-xs text-muted-foreground">+ {memberships.length - 10} more members</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
