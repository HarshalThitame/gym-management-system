"use client";

import { useCallback, useEffect, useState, useActionState } from "react";
import { Apple, Download, Droplets, Dumbbell, Edit3, Eye, Flame, Plus, UsersRound, Wheat } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveNutritionPlanAction, setNutritionPlanStatusAction } from "@/features/organization-owner/actions/nutrition-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type NutritionEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: unknown; moduleFilters?: Record<string, unknown>; };

// Use the actual DB types if data exists, otherwise use a simulated interface
type NutritionPlan = {
  id: string; gym_id: string | null; member_id: string; trainer_id: string | null;
  name: string; plan_type: string; description: string | null;
  target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number;
  water_target_ml: number; starts_on: string; ends_on: string | null;
  status: string; created_at: string; updated_at: string;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function NutritionEnterpriseModule({ dashboard }: NutritionEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<NutritionPlan | null>(null);
  const [detailPlan, setDetailPlan] = useState<NutritionPlan | null>(null);
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, formAction] = useActionState(saveNutritionPlanAction, initialAuthActionState);

  // Load plans from dashboard data or API
  useEffect(() => {
    if ("nutritionPlans" in dashboard && Array.isArray((dashboard as unknown as Record<string, unknown>).nutritionPlans)) {
      setPlans((dashboard as unknown as { nutritionPlans: NutritionPlan[] }).nutritionPlans);
    }
    setLoading(false);
  }, [dashboard]);

  const openCreate = useCallback(() => { setEditingPlan(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((p: NutritionPlan) => { setEditingPlan(p); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingPlan(null); }, []);
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);

  const handleStatus = useCallback(async (planId: string, status: string) => {
    const fd = new FormData(); fd.set("planId", planId); fd.set("status", status);
    const r = await setNutritionPlanStatusAction({ status: "idle" }, fd);
    showToast(r.message || "Done", r.status === "success" ? "success" : "error");
  }, []);

  // ── KPIs ──
  const activePlans = plans.filter((p) => p.status === "active").length;
  const draftPlans = plans.filter((p) => p.status === "draft").length;
  const completedPlans = plans.filter((p) => p.status === "completed").length;
  const trainersWithPlans = new Set(plans.filter((p) => p.trainer_id).map((p) => p.trainer_id)).size;
  const membersOnPlan = new Set(plans.filter((p) => p.status === "active" || p.status === "active").map((p) => p.member_id)).size;

  // ── Macro averages ──
  const avgCalories = plans.length > 0 ? Math.round(plans.reduce((s, p) => s + p.target_calories, 0) / plans.length) : 0;
  const avgProtein = plans.length > 0 ? Math.round(plans.reduce((s, p) => s + p.target_protein_g, 0) / plans.length) : 0;

  const items = plans.map((p) => {
    const member = dashboard.members.find((m) => m.id === p.member_id);
    const trainer = p.trainer_id ? dashboard.trainers.find((t) => t.id === p.trainer_id) : null;
    const gym = p.gym_id ? dashboard.gyms.find((g) => g.id === p.gym_id) : null;

    return {
      id: p.id,
      title: p.name,
      subtitle: `${member?.full_name ?? "Unknown"} · ${formatEnterpriseLabel(p.plan_type)}`,
      meta: `${gym?.name ?? "—"} · ${trainer?.display_name ?? "No trainer"} · ${p.starts_on ? new Date(p.starts_on).toLocaleDateString("en-IN") : "—"}${p.ends_on ? ` → ${new Date(p.ends_on).toLocaleDateString("en-IN")}` : ""}`,
      badge: p.status,
      badgeVariant: (p.status === "active" ? "success" : p.status === "draft" ? "neutral" : p.status === "completed" ? "info" : "warning") as "success" | "neutral" | "info" | "warning",
      status: p.status,
      sections: [
        { label: "Calories", value: `${p.target_calories} kcal` },
        { label: "Protein", value: `${p.target_protein_g}g` },
        { label: "Carbs", value: `${p.target_carbs_g}g` },
        { label: "Fat", value: `${p.target_fat_g}g` },
      ],
      actions: [
        { label: "Details", onClick: () => setDetailPlan(p), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        { label: "Edit", onClick: () => openEdit(p), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
        ...(p.status === "active"
          ? [{ label: "Pause", onClick: () => handleStatus(p.id, "paused"), variant: "secondary" as const, icon: <Dumbbell className="size-3.5" /> } as const]
          : p.status === "draft"
          ? [{ label: "Activate", onClick: () => handleStatus(p.id, "active"), variant: "primary" as const, icon: <Apple className="size-3.5" /> } as const]
          : p.status === "paused"
          ? [{ label: "Resume", onClick: () => handleStatus(p.id, "active"), variant: "primary" as const, icon: <Apple className="size-3.5" /> } as const]
          : []
        )
      ]
    };
  });

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading nutrition plans...</div>;
  }

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total nutrition plans" icon={<Apple className="size-5" />} label="Total Plans" value={String(plans.length)} />
        <StatCard detail="Active nutrition plans" icon={<Apple className="size-5" />} label="Active" value={String(activePlans)} />
        <StatCard detail="Members on a nutrition plan" icon={<UsersRound className="size-5" />} label="Members" value={formatCompactNumber(membersOnPlan)} />
        <StatCard detail="Trainers managing nutrition" icon={<Dumbbell className="size-5" />} label="Trainers" value={String(trainersWithPlans)} />
        <StatCard detail="Draft plans not yet active" icon={<Apple className="size-5" />} label="Drafts" value={String(draftPlans)} />
        <StatCard detail="Completed nutrition plans" icon={<Apple className="size-5" />} label="Completed" value={String(completedPlans)} />
        <StatCard detail="Average daily calorie target" icon={<Flame className="size-5" />} label="Avg Calories" value={`${avgCalories} kcal`} />
        <StatCard detail="Average daily protein target" icon={<Wheat className="size-5" />} label="Avg Protein" value={`${avgProtein}g`} />
      </section>

      {/* ═══ FILTERS + DATA LIST ═══ */}
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "draft", label: "Draft" },
            { value: "paused", label: "Paused" }, { value: "completed", label: "Completed" }
          ]},
          { key: "planType", label: "Type", options: [
            { value: "weight_loss", label: "Weight Loss" }, { value: "muscle_gain", label: "Muscle Gain" },
            { value: "maintenance", label: "Maintenance" }, { value: "custom", label: "Custom" }
          ]}
        ]}
        searchPlaceholder="Search by plan name or member..."
        onApply={handleApply}
        activeFilters={filters as unknown as Record<string, string>}
      />

      <DataList
        selectable
        bulkActions={[
          { label: "Export CSV", onClick: (ids) => {
            const data = plans.filter((p) => ids.includes(p.id)).map((p) => ({
              name: p.name, member: dashboard.members.find((m) => m.id === p.member_id)?.full_name,
              type: p.plan_type, status: p.status, calories: p.target_calories,
              protein: p.target_protein_g, carbs: p.target_carbs_g, fat: p.target_fat_g,
              water: p.water_target_ml, trainer: dashboard.trainers.find((t) => t.id === p.trainer_id)?.display_name,
            }));
            exportToCSV(data, "nutrition-plans-selected");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create Plan</Button>}
        headerTitle="Nutrition Plans" items={items}
        totalItems={plans.length} totalPages={Math.ceil(plans.length / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description={editingPlan ? `Editing ${editingPlan.name}` : "Create a new nutrition plan"} onClose={closeDrawer} open={drawerOpen} title={editingPlan ? "Edit Plan" : "Create Nutrition Plan"} size="xl">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingPlan ? <input name="planId" type="hidden" value={editingPlan.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Plan Name" required>
              <input className={selectClass} defaultValue={editingPlan?.name ?? ""} name="name" required type="text" placeholder="Summer Shred" />
            </DrawerField>
            <DrawerField label="Plan Type" required>
              <select className={selectClass} defaultValue={editingPlan?.plan_type ?? "weight_loss"} name="planType" required>
                <option value="weight_loss">Weight Loss</option>
                <option value="muscle_gain">Muscle Gain</option>
                <option value="maintenance">Maintenance</option>
                <option value="custom">Custom</option>
              </select>
            </DrawerField>
            <DrawerField label="Member" required>
              <select className={selectClass} defaultValue={editingPlan?.member_id ?? ""} name="memberId" required>
                <option value="">Select member</option>
                {dashboard.members.filter((m) => m.status === "active").map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name} ({m.member_code})</option>
                ))}
              </select>
            </DrawerField>
            <DrawerField label="Trainer">
              <select className={selectClass} defaultValue={editingPlan?.trainer_id ?? ""} name="trainerId">
                <option value="">None</option>
                {dashboard.trainers.filter((t) => t.status === "active").map((t) => (
                  <option key={t.id} value={t.id}>{t.display_name}</option>
                ))}
              </select>
            </DrawerField>
            <DrawerField label="Branch">
              <select className={selectClass} defaultValue={editingPlan?.gym_id ?? ""} name="gymId">
                <option value="">All</option>
                {dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Status">
              <select className={selectClass} defaultValue={editingPlan?.status ?? "draft"} name="status">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </DrawerField>
          </div>

          {/* Macro Targets */}
          <div className="rounded-lg border border-border bg-surface-muted p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Macro Targets</p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-1.5"><Flame className="size-3.5" /> Calories</label>
                <input className={selectClass} defaultValue={editingPlan?.target_calories ?? 2000} min={0} name="targetCalories" type="number" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-1.5"><Wheat className="size-3.5" /> Protein (g)</label>
                <input className={selectClass} defaultValue={editingPlan?.target_protein_g ?? 50} min={0} name="targetProtein" type="number" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-1.5"><Wheat className="size-3.5" /> Carbs (g)</label>
                <input className={selectClass} defaultValue={editingPlan?.target_carbs_g ?? 250} min={0} name="targetCarbs" type="number" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-1.5"><Wheat className="size-3.5" /> Fat (g)</label>
                <input className={selectClass} defaultValue={editingPlan?.target_fat_g ?? 65} min={0} name="targetFat" type="number" />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm font-bold flex items-center gap-1.5"><Droplets className="size-3.5" /> Water Target (ml)</label>
              <input className={`${selectClass} max-w-xs`} defaultValue={editingPlan?.water_target_ml ?? 2000} min={0} name="waterTarget" type="number" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Start Date" required>
              <input className={selectClass} defaultValue={editingPlan?.starts_on ?? new Date().toISOString().slice(0, 10)} name="startsOn" required type="date" />
            </DrawerField>
            <DrawerField label="End Date">
              <input className={selectClass} defaultValue={editingPlan?.ends_on ?? ""} name="endsOn" type="date" />
            </DrawerField>
          </div>

          <DrawerField label="Description">
            <textarea className={`${selectClass} min-h-[80px]`} defaultValue={editingPlan?.description ?? ""} name="description" placeholder="Plan goals, notes, restrictions..." rows={3} />
          </DrawerField>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingPlan ? "Update Plan" : "Create Plan"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ DETAIL PANEL ═══ */}
      {detailPlan ? <NutritionDetailPanel plan={detailPlan} dashboard={dashboard} onClose={() => setDetailPlan(null)} /> : null}
    </div>
  );
}

function NutritionDetailPanel({ plan, dashboard, onClose }: { plan: NutritionPlan; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
  const member = dashboard.members.find((m) => m.id === plan.member_id);
  const trainer = plan.trainer_id ? dashboard.trainers.find((t) => t.id === plan.trainer_id) : null;
  const gym = plan.gym_id ? dashboard.gyms.find((g) => g.id === plan.gym_id) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${plan.name} details`}>
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{plan.name}</h2>
              <EnterpriseStatusBadge status={plan.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{formatEnterpriseLabel(plan.plan_type)} · {member?.full_name ?? "Unknown"}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Apple className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Plan Info</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{formatEnterpriseLabel(plan.plan_type)}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={plan.status} /></div>
              <div><p className="text-xs text-muted-foreground">Start</p><p className="text-sm font-bold">{plan.starts_on ? new Date(plan.starts_on).toLocaleDateString("en-IN") : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">End</p><p className="text-sm font-bold">{plan.ends_on ? new Date(plan.ends_on).toLocaleDateString("en-IN") : "Ongoing"}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-lg font-black">Macro Targets</h3></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><span className="text-sm font-bold">Calories</span><span className="text-xl font-black">{plan.target_calories} kcal</span></div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (plan.target_calories / 3000) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-background p-3 text-center">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="text-lg font-black">{plan.target_protein_g}g</p>
                </div>
                <div className="rounded-md border border-border bg-background p-3 text-center">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="text-lg font-black">{plan.target_carbs_g}g</p>
                </div>
                <div className="rounded-md border border-border bg-background p-3 text-center">
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="text-lg font-black">{plan.target_fat_g}g</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-3">
                <Droplets className="size-4 text-blue-500" />
                <span className="text-sm font-semibold text-blue-800">Water: {plan.water_target_ml} ml / day</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-lg font-black">Assignment</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Member</p><p className="text-sm font-bold">{member?.full_name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Code</p><p className="text-sm font-bold">{member?.member_code ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Trainer</p><p className="text-sm font-bold">{trainer?.display_name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Gym</p><p className="text-sm font-bold">{gym?.name ?? "—"}</p></div>
            </CardContent>
          </Card>

          {plan.description ? (
            <Card>
              <CardHeader><h3 className="text-lg font-black">Description</h3></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{plan.description}</p></CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
