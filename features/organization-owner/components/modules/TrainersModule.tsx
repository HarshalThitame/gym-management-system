"use client";

import { useCallback, useState, useActionState } from "react";
import { Dumbbell, Edit3, Plus, UserRound } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveTrainerAction, assignMemberToTrainerAction } from "@/features/organization-owner/actions/trainer-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { StatCard } from "@/components/ui/stat-card";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type TrainersEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function TrainersEnterpriseModule({ dashboard, moduleData }: TrainersEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<TrainerRow | null>(null);
  const [assigningTrainer, setAssigningTrainer] = useState<TrainerRow | null>(null);
  const [state, formAction] = useActionState(saveTrainerAction, initialAuthActionState);
  const [assignState, assignFormAction] = useActionState(assignMemberToTrainerAction, initialAuthActionState);

  const initial = (moduleData?.items ?? dashboard.trainers) as TrainerRow[];
  const { items: trainers, addOptimistic, updateOptimistic } = useOptimisticList<TrainerRow>(initial);

  const openCreate = useCallback(() => { setEditingTrainer(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((t: TrainerRow) => { setEditingTrainer(t); setDrawerOpen(true); }, []);
  const openAssign = useCallback((t: TrainerRow) => { setAssigningTrainer(t); setAssignDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingTrainer(null); }, []);
  const closeAssign = useCallback(() => { setAssignDrawerOpen(false); setAssigningTrainer(null); }, []);
  const handleApplyFilters = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);

  const items = trainers.map((t) => ({
    id: t.id, title: t.display_name,
    subtitle: `Code: ${t.employee_code ?? "N/A"} · ${formatEnterpriseLabel(t.employment_type)}`,
    meta: `${t.years_experience ?? 0} years experience`,
    badge: t.status,
    badgeVariant: (t.status === "active" ? "success" : t.status === "on_leave" ? "warning" : "neutral") as "success" | "warning" | "neutral",
    sections: [
      { label: "Type", value: formatEnterpriseLabel(t.employment_type) },
      { label: "Experience", value: `${t.years_experience ?? 0} years` },
      { label: "Status", value: t.status }
    ],
    actions: [
      { label: "Edit", onClick: () => openEdit(t), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
      { label: "Assign", onClick: () => openAssign(t), variant: "secondary" as const, icon: <UserRound className="size-3.5" /> }
    ]
  }));

  const totalItems = moduleData?.items?.length ?? dashboard.trainers.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Trainer profiles" icon={<Dumbbell className="size-5" />} label="Total" value={String(trainers.length)} />
        <StatCard detail="Active trainers" icon={<Dumbbell className="size-5" />} label="Active" value={String(trainers.filter((t) => t.status === "active").length)} />
        <StatCard detail="On leave" icon={<Dumbbell className="size-5" />} label="On Leave" value={String(trainers.filter((t) => t.status === "on_leave").length)} />
        <StatCard detail="Average utilization" icon={<Dumbbell className="size-5" />} label="Utilization" value={`${dashboard.metrics.avgTrainerUtilization}%`} />
      </section>
      <FilterBar filterGroups={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "on_leave", label: "On Leave" }] }]} searchPlaceholder="Search trainers..." onApply={handleApplyFilters} activeFilters={filters as unknown as unknown as Record<string, string>} />
      <DataList headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Trainer</Button>} headerTitle="Trainers" items={items} totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
      <OrgOwnerDrawer description={editingTrainer ? `Editing ${editingTrainer.display_name}` : "Add a new trainer"} onClose={closeDrawer} open={drawerOpen} title={editingTrainer ? "Edit Trainer" : "Add Trainer"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingTrainer ? <input name="trainerId" type="hidden" value={editingTrainer.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required><select className={selectClass} defaultValue={editingTrainer?.gym_id ?? ""} name="gymId" required><option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></DrawerField>
            <DrawerField label="Name" required><input className={selectClass} defaultValue={editingTrainer?.display_name ?? ""} name="displayName" required type="text" /></DrawerField>
            <DrawerField label="Email"><input className={selectClass} defaultValue={editingTrainer?.email ?? ""} name="email" type="email" /></DrawerField>
            <DrawerField label="Phone"><input className={selectClass} defaultValue={editingTrainer?.phone ?? ""} name="phone" type="text" /></DrawerField>
            <DrawerField label="Experience"><input className={selectClass} defaultValue={editingTrainer?.years_experience ?? 0} min={0} name="yearsExperience" type="number" /></DrawerField>
            <DrawerField label="Type"><select className={selectClass} defaultValue={editingTrainer?.employment_type ?? "full_time"} name="employmentType"><option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contract">Contract</option></select></DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingTrainer ? "Update" : "Add"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
      <OrgOwnerDrawer description={`Assign to ${assigningTrainer?.display_name ?? "trainer"}`} onClose={closeAssign} open={assignDrawerOpen} title="Assign Member" size="md">
        <form action={assignFormAction} className="space-y-5">
          <DrawerFormMessage status={assignState.status} message={assignState.message} />
          <input name="trainerId" type="hidden" value={assigningTrainer?.id ?? ""} />
          <DrawerField label="Member" required><select className={selectClass} defaultValue="" name="memberId" required><option value="">Select member</option>{dashboard.members.filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></DrawerField>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeAssign} type="button">Cancel</button>
            <DrawerSubmitButton>Assign</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
