"use client";

import { useCallback, useState, useActionState, useRef } from "react";
import { Building2, ChevronDown, ChevronRight, Download, Edit3, Eye, MapPin, Plus, ShieldAlert, ShieldCheck, Trash2, UserRound } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { GymDetailPanel } from "@/features/organization-owner/components/gym-detail-panel";
import { StatCard } from "@/components/ui/stat-card";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveGymAction, setGymStatusAction } from "@/features/organization-owner/actions/gym-actions";
import { saveBranchAction, setBranchStatusAction } from "@/features/organization-owner/actions/branch-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import type { GymRow } from "@/types/enterprise";
import type { Database } from "@/types/database";

type GymsModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: GymRow[]; total: number; page: number; pageSize: number; totalPages: number };
  moduleFilters?: Record<string, unknown>;
};

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function GymsModule({ dashboard, moduleData }: GymsModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [branchDrawerOpen, setBranchDrawerOpen] = useState(false);
  const [editingGym, setEditingGym] = useState<GymRow | null>(null);
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [branchParentGymId, setBranchParentGymId] = useState<string | null>(null);
  const [expandedGymId, setExpandedGymId] = useState<string | null>(null);
  const [detailGym, setDetailGym] = useState<GymRow | null>(null);
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving">("idle");
  const [state, formAction] = useActionState(saveGymAction, initialAuthActionState);
  const [branchState, branchFormAction] = useActionState(saveBranchAction, initialAuthActionState);
  const formRef = useRef<HTMLFormElement>(null);

  const initialItems = ((moduleData?.items ?? dashboard.gyms) as GymRow[]);
  const { items: gyms, addOptimistic, updateOptimistic, removeOptimistic } = useOptimisticList<GymRow>(initialItems);
  const branches = dashboard.branches;

  // ── KPIs ──
  const activeGyms = gyms.filter((g) => g.status === "active").length;
  const suspendedGyms = gyms.filter((g) => g.status === "suspended").length;
  const totalBranches = branches.length;
  const activeBranches = branches.filter((b) => b.status === "active").length;
  const totalCapacity = branches.reduce((s, b) => s + Number(b.capacity ?? 0), 0);

  // ── Gym CRUD ──
  const openCreate = useCallback(() => { setEditingGym(null); setSavingStatus("idle"); setDrawerOpen(true); }, []);
  const openEdit = useCallback((gym: GymRow) => { setEditingGym(gym); setSavingStatus("idle"); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingGym(null); setSavingStatus("idle"); }, []);

  // ── Branch CRUD ──
  const openBranchCreate = useCallback((gymId: string) => { setEditingBranch(null); setBranchParentGymId(gymId); setBranchDrawerOpen(true); }, []);
  const openBranchEdit = useCallback((branch: BranchRow) => { setEditingBranch(branch); setBranchParentGymId(null); setBranchDrawerOpen(true); }, []);
  const closeBranchDrawer = useCallback(() => { setBranchDrawerOpen(false); setEditingBranch(null); setBranchParentGymId(null); }, []);

  // ── Optimistic submit ──
  const handleOptimisticSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    if (!name) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticGym: GymRow = {
      id: tempId, name, slug: (formData.get("slug") as string) || name.toLowerCase().replace(/\s+/g, "-"),
      timezone: (formData.get("timezone") as string) || "Asia/Kolkata",
      currency: (formData.get("currency") as string) || "INR",
      status: (formData.get("status") as "active" | "suspended" | "archived") || "active",
      organization_id: dashboard.organization.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    addOptimistic(optimisticGym);
    setSavingStatus("saving");
    closeDrawer();
    showToast("Saving gym...", "info");

    const fd = new FormData(form);
    const result = await saveGymAction({ status: "idle", message: null } as never, fd);
    if (result.status === "success") { removeOptimistic(tempId); showToast("Gym saved", "success"); }
    else { removeOptimistic(tempId); showToast(result.message || "Failed", "error"); }
    setSavingStatus("idle");
  }, [addOptimistic, removeOptimistic, closeDrawer, dashboard.organization.id]);

  const handleSetStatus = useCallback(async (gymId: string, status: "active" | "suspended" | "archived") => {
    updateOptimistic(gymId, { status });
    const fd = new FormData(); fd.set("gymId", gymId); fd.set("status", status);
    const result = await setGymStatusAction({ status: "idle", message: null } as never, fd);
    if (result.status !== "success") {
      updateOptimistic(gymId, { status: dashboard.gyms.find((g) => g.id === gymId)?.status ?? "active" });
      showToast(result.message || "Failed", "error");
    } else showToast(`Gym ${status}`, "success");
  }, [updateOptimistic, dashboard.gyms]);

  const handleApplyFilters = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, status: f.status });
  }, [navigate]);

  const handleBranchStatus = useCallback(async (branchId: string, status: string) => {
    const fd = new FormData(); fd.set("branchId", branchId); fd.set("status", status);
    const r = await setBranchStatusAction({ status: "idle", message: null } as never, fd);
    showToast(r.message || `Branch ${status}`, r.status === "success" ? "success" : "error");
  }, []);

  const toggleExpand = useCallback((gymId: string) => {
    setExpandedGymId(expandedGymId === gymId ? null : gymId);
  }, [expandedGymId]);

  // ── Compute DataCard items ──
  const items = gyms.map((gym) => {
    const gymBranches = branches.filter((b) => b.gym_id === gym.id);
    const activeGymBranches = gymBranches.filter((b) => b.status === "active").length;
    const gymCapacity = gymBranches.reduce((s, b) => s + Number(b.capacity ?? 0), 0);
    const gymMembers = dashboard.members.filter((m) => m.gym_id === gym.id);
    const gymTrainers = dashboard.trainers.filter((t) => t.gym_id === gym.id);
    const gymPayments = dashboard.payments.filter((p) => p.gym_id === gym.id);
    const usedCapacity = gymMembers.length;
    const capacityPercent = gymCapacity > 0 ? Math.round((usedCapacity / gymCapacity) * 100) : 0;

    // Find gym admin
    const gymAdmins = dashboard.branchUsers.filter((u) => {
      const userBranches = dashboard.branches.filter((b) => b.gym_id === gym.id);
      return userBranches.some((b) => b.id === u.branch_id) && u.role_name === "gym_admin";
    });

    // First branch with address for location context
    const firstBranch = gymBranches[0];
    const location = firstBranch ? [firstBranch.city, firstBranch.state].filter(Boolean).join(", ") : null;

    const gymRevenue = gymPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

    return {
      id: gym.id,
      title: gym.name,
      subtitle: location ? `${location}` : `Slug: ${gym.slug}`,
      meta: `${gym.timezone} · ${gym.currency}${location ? "" : ` · Created ${new Date(gym.created_at).toLocaleDateString("en-IN")}`}`,
      badge: gym.status === "active" ? "Active" : gym.status === "suspended" ? "Suspended" : "Archived",
      badgeVariant: (gym.status === "active" ? "success" : gym.status === "suspended" ? "warning" : "neutral") as "success" | "warning" | "neutral",
      status: gym.status,
      sections: [
        { label: "Branches", value: `${activeGymBranches}/${gymBranches.length} active` },
        { label: "Capacity", value: gymCapacity > 0 ? `${formatCompactNumber(usedCapacity)}/${formatCompactNumber(gymCapacity)} (${capacityPercent}%)` : "Not set" },
        { label: "Revenue", value: formatCurrency(gymRevenue) },
        { label: "Members", value: `${gymMembers.length} total · ${gymMembers.filter((m) => m.status === "active").length} active` },
      ],
      actions: (() => {
        const base = [
          { label: "Details", onClick: () => setDetailGym(gym), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
          { label: "Edit", onClick: () => openEdit(gym), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
          { label: "Branches", onClick: () => toggleExpand(gym.id), variant: "secondary" as const, icon: <Building2 className="size-3.5" /> },
        ];
        if (gym.status === "active") {
          return [...base,
            { label: "Suspend", onClick: () => handleSetStatus(gym.id, "suspended"), variant: "destructive" as const, icon: <ShieldAlert className="size-3.5" /> },
            { label: "Delete", onClick: () => { if (window.confirm("Delete this gym?")) handleSetStatus(gym.id, "archived"); }, variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> },
          ];
        }
        if (gym.status === "suspended") {
          return [...base, { label: "Activate", onClick: () => handleSetStatus(gym.id, "active"), variant: "primary" as const, icon: <ShieldCheck className="size-3.5" /> }];
        }
        return base;
      })(),
      children: expandedGymId === gym.id ? <GymBranchList gymId={gym.id} branches={gymBranches} onAddBranch={openBranchCreate} onEditBranch={openBranchEdit} onSetStatus={handleBranchStatus} /> : undefined
    };
  });

  const totalItems = moduleData?.total ?? gyms.length;

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total gym locations" icon={<Building2 className="size-5" />} label="Total Gyms" value={String(gyms.length)} />
        <StatCard detail="Active gyms" icon={<Building2 className="size-5" />} label="Active" value={String(activeGyms)} />
        <StatCard detail="Suspended gyms" icon={<Building2 className="size-5" />} label="Suspended" value={String(suspendedGyms)} />
        <StatCard detail="Total branches across all gyms" icon={<Building2 className="size-5" />} label="Branches" value={`${activeBranches}/${totalBranches} active`} />
      </section>

      {/* ═══ FILTERS + DATA LIST ═══ */}
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "archived", label: "Archived" }
          ]}
        ]}
        searchPlaceholder="Search by gym name, slug, timezone, or currency..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as Record<string, string>}
      />

      <DataList
        selectable
        bulkActions={[
          { label: "Export CSV", onClick: (ids) => { const data = gyms.filter((g) => ids.includes(g.id)).map((g) => ({ id: g.id, name: g.name, slug: g.slug, status: g.status, timezone: g.timezone, currency: g.currency })); exportToCSV(data, "gyms-export"); }, variant: "secondary" as const, icon: <Download className="size-3.5" /> },
          { label: "Suspend", onClick: async (ids) => { for (const id of ids) await handleSetStatus(id, "suspended"); showToast(`${ids.length} gym(s) suspended`, "success"); }, variant: "destructive" as const, icon: <ShieldAlert className="size-3.5" /> },
          { label: "Activate", onClick: async (ids) => { for (const id of ids) await handleSetStatus(id, "active"); showToast(`${ids.length} gym(s) activated`, "success"); }, variant: "primary" as const, icon: <ShieldCheck className="size-3.5" /> },
        ]}
        onExportCSV={() => exportToCSV(gyms.map((g) => ({ id: g.id, name: g.name, slug: g.slug, status: g.status, timezone: g.timezone, currency: g.currency })), "all-gyms")}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create Gym</Button>}
        headerTitle="Gyms"
        items={items}
        totalItems={totalItems}
        totalPages={moduleData?.totalPages ?? Math.ceil(gyms.length / 12)}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ GYM DRAWER ═══ */}
      <OrgOwnerDrawer description={editingGym ? `Editing ${editingGym.name}` : "Create a new gym"} onClose={closeDrawer} open={drawerOpen} title={editingGym ? "Edit Gym" : "Create Gym"} size="lg">
        <form ref={formRef} onSubmit={handleOptimisticSubmit} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingGym ? <input name="gymId" type="hidden" value={editingGym.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym Name" required>
              <input className={selectClass} defaultValue={editingGym?.name ?? ""} name="name" placeholder="Apex Fitness Mumbai" required type="text" />
            </DrawerField>
            <DrawerField label="Slug">
              <input className={selectClass} defaultValue={editingGym?.slug ?? ""} name="slug" placeholder="apex-fitness-mumbai" type="text" />
            </DrawerField>
            <DrawerField label="Timezone">
              <input className={selectClass} defaultValue={editingGym?.timezone ?? "Asia/Kolkata"} name="timezone" type="text" />
            </DrawerField>
            <DrawerField label="Currency">
              <input className={selectClass} defaultValue={editingGym?.currency ?? "INR"} name="currency" maxLength={3} type="text" />
            </DrawerField>
            <DrawerField label="Status">
              <select className={selectClass} defaultValue={editingGym?.status ?? "active"} name="status">
                <option value="active">Active</option><option value="suspended">Suspended</option><option value="archived">Archived</option>
              </select>
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton loading={savingStatus === "saving"}>{editingGym ? "Update Gym" : "Create Gym"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ BRANCH DRAWER ═══ */}
      <OrgOwnerDrawer description={editingBranch ? `Editing ${editingBranch.name}` : "Add a new branch"} onClose={closeBranchDrawer} open={branchDrawerOpen} title={editingBranch ? "Edit Branch" : "Add Branch"} size="lg">
        <form action={branchFormAction} className="space-y-5">
          <DrawerFormMessage status={branchState.status} message={branchState.message} />
          <input name="gymId" type="hidden" value={editingBranch?.gym_id ?? branchParentGymId ?? ""} />
          {editingBranch ? <input name="branchId" type="hidden" value={editingBranch.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Branch Name" required>
              <input className={selectClass} defaultValue={editingBranch?.name ?? ""} name="name" placeholder="Bandra West" required type="text" />
            </DrawerField>
            <DrawerField label="Branch Code" required>
              <input className={selectClass} defaultValue={editingBranch?.branch_code ?? ""} name="branchCode" placeholder="BAN-W" required type="text" />
            </DrawerField>
            <DrawerField label="Timezone">
              <input className={selectClass} defaultValue={editingBranch?.timezone ?? "Asia/Kolkata"} name="timezone" type="text" />
            </DrawerField>
            <DrawerField label="Currency">
              <input className={selectClass} defaultValue={editingBranch?.currency ?? "INR"} name="currency" maxLength={3} type="text" />
            </DrawerField>
            <DrawerField label="Capacity">
              <input className={selectClass} defaultValue={editingBranch?.capacity ?? 0} min={0} name="capacity" type="number" />
            </DrawerField>
            <DrawerField label="Phone">
              <input className={selectClass} defaultValue={editingBranch?.phone ?? ""} name="phone" type="text" />
            </DrawerField>
            <DrawerField label="Email">
              <input className={selectClass} defaultValue={editingBranch?.email ?? ""} name="email" type="email" />
            </DrawerField>
            <DrawerField label="Status">
              <select className={selectClass} defaultValue={editingBranch?.status ?? "active"} name="status">
                <option value="active">Active</option><option value="suspended">Suspended</option><option value="maintenance">Maintenance</option>
              </select>
            </DrawerField>
          </div>
          <div className="grid gap-5">
            <DrawerField label="Address">
              <input className={selectClass} defaultValue={editingBranch?.address ?? ""} name="address" type="text" />
            </DrawerField>
            <div className="grid grid-cols-3 gap-3">
              <DrawerField label="City"><input className={selectClass} defaultValue={editingBranch?.city ?? ""} name="city" type="text" /></DrawerField>
              <DrawerField label="State"><input className={selectClass} defaultValue={editingBranch?.state ?? ""} name="state" type="text" /></DrawerField>
              <DrawerField label="Country"><input className={selectClass} defaultValue={editingBranch?.country ?? ""} name="country" type="text" /></DrawerField>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeBranchDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingBranch ? "Update Branch" : "Add Branch"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ GYM DETAIL PANEL ═══ */}
      {detailGym ? <GymDetailPanel gym={detailGym} dashboard={dashboard} onClose={() => setDetailGym(null)} /> : null}
    </div>
  );
}

/* ─── Inline Branch List ─── */
function GymBranchList({ gymId, branches, onAddBranch, onEditBranch, onSetStatus }: {
  gymId: string; branches: BranchRow[]; onAddBranch: (gymId: string) => void; onEditBranch: (branch: BranchRow) => void; onSetStatus: (branchId: string, status: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{branches.length} Branch{branches.length !== 1 ? "es" : ""}</p>
        <button className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold hover:border-border-strong" onClick={() => onAddBranch(gymId)} type="button"><Plus className="size-3" /> Add Branch</button>
      </div>
      {branches.length === 0 ? (
        <p className="text-xs text-muted-foreground">No branches yet. Click &quot;Add Branch&quot; to create one.</p>
      ) : (
        <div className="space-y-2">
          {branches.map((branch) => (
            <div key={branch.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3 transition-all hover:border-border-strong">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{branch.name}</p>
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{branch.branch_code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[branch.city, branch.state, branch.country].filter(Boolean).join(", ") || "No address"}
                    {branch.phone ? ` · ${branch.phone}` : ""}
                    {branch.capacity ? ` · Capacity: ${branch.capacity}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  branch.status === "active" ? "bg-green-100 text-green-700" :
                  branch.status === "suspended" ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                }`}>{branch.status}</span>
                <button className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => onEditBranch(branch)} type="button" aria-label="Edit branch"><Edit3 className="size-3.5" /></button>
                {branch.status === "active" ? (
                  <button className="rounded-md p-1 text-red-500 hover:bg-red-50" onClick={() => onSetStatus(branch.id, "suspended")} type="button" aria-label="Suspend branch"><ShieldAlert className="size-3.5" /></button>
                ) : (
                  <button className="rounded-md p-1 text-green-600 hover:bg-green-50" onClick={() => onSetStatus(branch.id, "active")} type="button" aria-label="Activate branch"><ShieldCheck className="size-3.5" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
