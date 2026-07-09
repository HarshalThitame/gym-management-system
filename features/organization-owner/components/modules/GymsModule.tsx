"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Building2, Download, Edit3, Eye, Plus, ShieldAlert, ShieldCheck, Trash2, UserRound, Search, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { GymDetailPanel } from "@/features/organization-owner/components/gym-detail-panel";
import { StatCard } from "@/components/ui/stat-card";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { saveGymAction, setGymStatusAction } from "@/features/organization-owner/actions/gym-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatCurrency, slugifyEnterpriseName } from "@/features/enterprise/lib/business-rules";
import { useHasFeature } from "@/features/organization-owner/entitlements";
import { CrossBranchAccessPanel } from "@/features/organization-owner/components/modules/CrossBranchAccessPanel";
import { GenericConfirmDialog } from "@/features/organization-owner/components/modules/GenericConfirmDialog";
import { GenericSuccessDialog } from "@/features/organization-owner/components/modules/GenericSuccessDialog";
import { EnterpriseOutcomeDialog, type EnterpriseOutcome } from "@/features/enterprise/components/enterprise-outcome-dialog";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import type { GymRow } from "@/types/enterprise";

type BranchesModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: GymRow[]; total: number; page: number; pageSize: number; totalPages: number };
  moduleFilters?: Record<string, unknown>;
};

type StatKey = "all" | "active" | "suspended" | null;

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function BranchesModule({ dashboard, moduleData }: BranchesModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGym, setEditingGym] = useState<GymRow | null>(null);
  const [detailGym, setDetailGym] = useState<GymRow | null>(null);
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving">("idle");
  const [moduleTab, setModuleTab] = useState<"gyms" | "cross-branch">("gyms");
  const [statPanel, setStatPanel] = useState<StatKey>(null);
  const [gymOutcome, setGymOutcome] = useState<EnterpriseOutcome | null>(null);
  const [gymFormState, setGymFormState] = useState<AuthActionState>(initialAuthActionState);
  const [gymName, setGymName] = useState("");
  const [successAction, setSuccessAction] = useState<{ action: "created" | "updated" | "deleted"; title: string; itemName: string } | null>(null);
  const [pendingDeleteGymId, setPendingDeleteGymId] = useState<string | null>(null);
  const [pendingSuspendGymId, setPendingSuspendGymId] = useState<string | null>(null);
  const slugPreview = useMemo(() => slugifyEnterpriseName(gymName), [gymName]);

  const initialItems = ((moduleData?.items ?? dashboard.gyms) as GymRow[]);
  const { items: gyms, addOptimistic, updateOptimistic, removeOptimistic } = useOptimisticList<GymRow>(initialItems);

  const hasCrossBranchFeature = useHasFeature("cross_branch_member_access");

  // ── KPIs ──
  const activeGyms = gyms.filter((g) => g.status === "active").length;
  const suspendedGyms = gyms.filter((g) => g.status === "suspended").length;

  // ── Gym CRUD ──
  const openCreate = useCallback(() => {
    setEditingGym(null);
    setGymName("");
    setGymFormState(initialAuthActionState);
    setGymOutcome(null);
    setSuccessAction(null);
    setSavingStatus("idle");
    setDrawerOpen(true);
  }, []);
  const openEdit = useCallback((gym: GymRow) => {
    setEditingGym(gym);
    setGymName(gym.name);
    setGymFormState(initialAuthActionState);
    setGymOutcome(null);
    setSuccessAction(null);
    setSavingStatus("idle");
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingGym(null);
    setGymName("");
    setGymFormState(initialAuthActionState);
    setGymOutcome(null);
    setSuccessAction(null);
    setSavingStatus("idle");
  }, []);

  // ── Optimistic submit ──
  const handleOptimisticSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const timezone = String(formData.get("timezone") ?? "").trim();
    const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
    if (!name || !timezone || !currency) {
      const missing: Record<string, string[]> = {};
      if (!name) missing.name = ["Gym name is required."];
      if (!timezone) missing.timezone = ["Timezone is required."];
      if (!currency) missing.currency = ["Currency is required."];
      const errorState: AuthActionState = { status: "error", message: "Complete the required gym details before saving.", fieldErrors: missing };
      setGymFormState(errorState);
      setGymOutcome({
        status: "error",
        title: "Gym details incomplete",
        itemName: name || "New gym",
        message: errorState.message,
        details: Object.entries(missing).map(([label, values]) => ({ label: label === "name" ? "Gym name" : label === "timezone" ? "Timezone" : "Currency", value: values[0] ?? "Required" }))
      });
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticGym: GymRow = {
      id: tempId,
      name,
      slug: slugifyEnterpriseName(name),
      timezone,
      currency,
      status: (formData.get("status") as "active" | "suspended" | "archived") || "active",
      organization_id: dashboard.organization.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    const isEdit = !!editingGym;
    addOptimistic(optimisticGym);
    setSavingStatus("saving");

    const fd = new FormData(form);
    const result = await saveGymAction({ status: "idle", message: "" }, fd);
    setGymFormState(result);
    if (result.status === "success") {
      removeOptimistic(tempId);
      const gymData = result.gymData;
      if (isEdit) {
        setSuccessAction({ action: "updated", title: "Gym Updated!", itemName: name });
      } else {
        setGymOutcome({
          status: "success",
          title: "Gym Created",
          itemName: gymData?.name ?? name,
          message: result.message,
          details: gymData
            ? [
                { label: "Slug", value: gymData.slug },
                { label: "Timezone", value: gymData.timezone },
                { label: "Currency", value: gymData.currency },
                { label: "Status", value: gymData.status }
              ]
            : []
        });
      }
      setDrawerOpen(false);
    } else {
      removeOptimistic(tempId);
      setGymOutcome({
        status: "error",
        title: isEdit ? "Gym update failed" : "Gym creation failed",
        itemName: name || "Gym",
        message: result.message || "We could not save the gym right now.",
        details: Object.entries(result.fieldErrors ?? {}).map(([key, values]) => ({
          label: key.replace(/([A-Z])/g, " $1").replace(/^./, (match) => match.toUpperCase()),
          value: values.join(", ")
        }))
      });
    }
    setSavingStatus("idle");
  }, [addOptimistic, removeOptimistic, dashboard.organization.id, editingGym]);

  const handleSetStatus = useCallback(async (gymId: string, status: "active" | "suspended" | "archived") => {
    updateOptimistic(gymId, { status });
    const fd = new FormData(); fd.set("gymId", gymId); fd.set("status", status);
    const result = await setGymStatusAction({ status: "idle", message: null } as never, fd);
    if (result.status !== "success") {
      updateOptimistic(gymId, { status: dashboard.gyms.find((g) => g.id === gymId)?.status ?? "active" });
      showToast(result.message || "Failed", "error");
    } else {
      if (status === "archived") {
        const name = gyms.find((g) => g.id === gymId)?.name ?? "";
        setSuccessAction({ action: "deleted", title: "Gym Deleted!", itemName: name });
      } else {
        showToast(`Gym ${status}`, "success");
      }
    }
  }, [updateOptimistic, dashboard.gyms, gyms]);

  const handleApplyFilters = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, status: f.status });
  }, [navigate]);

  // ── Compute DataCard items ──
  const items = gyms.map((gym) => {
    const gymMembers = dashboard.members.filter((m) => m.gym_id === gym.id);
    const gymTrainers = dashboard.trainers.filter((t) => t.gym_id === gym.id);
    const gymPayments = dashboard.payments.filter((p) => p.gym_id === gym.id);

    const gymRevenue = gymPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

    return {
      id: gym.id,
      title: gym.name,
      subtitle: `Slug: ${gym.slug}`,
      meta: `${gym.timezone} · ${gym.currency} · Created ${new Date(gym.created_at).toLocaleDateString("en-IN")}`,
      badge: gym.status === "active" ? "Active" : gym.status === "suspended" ? "Suspended" : "Archived",
      badgeVariant: (gym.status === "active" ? "success" : gym.status === "suspended" ? "warning" : "neutral") as "success" | "warning" | "neutral",
      status: gym.status,
      sections: [
        { label: "Revenue", value: formatCurrency(gymRevenue) },
        { label: "Members", value: `${gymMembers.length} total · ${gymMembers.filter((m) => m.status === "active").length} active` },
      ],
      actions: (() => {
        const base = [
          { label: "Details", onClick: () => setDetailGym(gym), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
          { label: "Edit", onClick: () => openEdit(gym), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
        ];
        if (gym.status === "active") {
          return [...base,
            { label: "Suspend", onClick: () => setPendingSuspendGymId(gym.id), variant: "destructive" as const, icon: <ShieldAlert className="size-3.5" /> },
            { label: "Delete", onClick: () => setPendingDeleteGymId(gym.id), variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> },
          ];
        }
        if (gym.status === "suspended") {
          return [...base, { label: "Activate", onClick: () => handleSetStatus(gym.id, "active"), variant: "primary" as const, icon: <ShieldCheck className="size-3.5" /> }];
        }
        return base;
      })(),
    };
  });

  const totalItems = moduleData?.total ?? gyms.length;

  return (
    <div className="space-y-6">
      {/* ═══ SUB-TABS ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${moduleTab === "gyms" ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setModuleTab("gyms")}
          type="button"
        >
          <Building2 className="size-4" /> Gyms
        </motion.button>
        {hasCrossBranchFeature ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${moduleTab === "cross-branch" ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setModuleTab("cross-branch")}
            type="button"
          >
            <ShieldCheck className="size-4" /> Cross-Gym Access
          </motion.button>
        ) : null}
      </motion.div>

      {moduleTab === "cross-branch" ? (
        <CrossBranchAccessPanel dashboard={dashboard} />
      ) : (
        <>
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          type="button" onClick={() => setStatPanel("all")} className="text-left transition-all">
          <StatCard detail="Total gyms across your organization" icon={<Building2 className="size-5" />} label="Total Gyms" value={String(gyms.length)} />
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          type="button" onClick={() => setStatPanel("active")} className="text-left transition-all">
          <StatCard detail="Active gyms" icon={<Building2 className="size-5" />} label="Active" value={String(activeGyms)} />
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          type="button" onClick={() => setStatPanel("suspended")} className="text-left transition-all">
          <StatCard detail="Suspended gyms" icon={<Building2 className="size-5" />} label="Suspended" value={String(suspendedGyms)} />
        </motion.button>
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

      {/* ═══ LOCATION DRAWER ═══ */}
      <OrgOwnerDrawer description={editingGym ? `Editing ${editingGym.name}` : "Create a new gym"} onClose={closeDrawer} open={drawerOpen} title={editingGym ? "Edit Gym" : "Create Gym"} size="lg">
        <form onSubmit={handleOptimisticSubmit} className="space-y-5">
          <DrawerFormMessage status={gymFormState.status} message={gymFormState.message} />
          {editingGym ? <input name="gymId" type="hidden" value={editingGym.id} /> : null}
          <input name="slug" type="hidden" value={editingGym?.slug ?? slugPreview} />
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym Name" required>
              <input
                className={selectClass}
                defaultValue={editingGym?.name ?? ""}
                name="name"
                onChange={(event) => setGymName(event.target.value)}
                placeholder="Bandra West Fitness"
                required
                type="text"
              />
            </DrawerField>
            <DrawerField label="Slug (auto-generated)">
              <input className={selectClass} placeholder="Auto-generated from the gym name" readOnly value={editingGym?.slug ?? slugPreview} />
            </DrawerField>
            <DrawerField label="Timezone" required>
              <input className={selectClass} defaultValue={editingGym?.timezone ?? "Asia/Kolkata"} name="timezone" required type="text" />
            </DrawerField>
            <DrawerField label="Currency" required>
              <input className={selectClass} defaultValue={editingGym?.currency ?? "INR"} name="currency" maxLength={3} required type="text" />
            </DrawerField>
            <DrawerField label="Status" required>
              <select className={selectClass} defaultValue={editingGym?.status ?? "active"} name="status" required>
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

      {/* ═══ GYM DETAIL PANEL ═══ */}
      {detailGym ? <GymDetailPanel gym={detailGym} dashboard={dashboard} onClose={() => setDetailGym(null)} /> : null}

      {/* ═══ STAT DETAIL PANEL ═══ */}
      <AnimatePresence>
        {statPanel ? (
          <motion.div
            key="stat-panel"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <LocationStatDetailPanel
              statKey={statPanel}
              gyms={gyms}
              activeGyms={activeGyms}
              suspendedGyms={suspendedGyms}
              dashboard={dashboard}
              onClose={() => setStatPanel(null)}
              onViewDetail={(gym) => { setStatPanel(null); setDetailGym(gym); }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <EnterpriseOutcomeDialog
        open={!!gymOutcome}
        outcome={gymOutcome}
        onClose={() => setGymOutcome(null)}
        actionLabel="Close"
      />
      <GenericSuccessDialog
        action={successAction?.action ?? "created"}
        itemName={successAction?.itemName ?? ""}
        onClose={() => setSuccessAction(null)}
        open={successAction !== null}
        title={successAction?.title ?? ""}
      />
      <GenericConfirmDialog
        open={!!pendingDeleteGymId}
        onConfirm={() => { if (pendingDeleteGymId) { handleSetStatus(pendingDeleteGymId, "archived"); setPendingDeleteGymId(null); } }}
        onCancel={() => setPendingDeleteGymId(null)}
        title="Delete Gym?"
        itemName={gyms.find(g => g.id === pendingDeleteGymId)?.name ?? ""}
        warning="This will archive the gym and its data. This action can be reversed."
      />
      <GenericConfirmDialog
        open={!!pendingSuspendGymId}
        onConfirm={() => { if (pendingSuspendGymId) { handleSetStatus(pendingSuspendGymId, "suspended"); setPendingSuspendGymId(null); } }}
        onCancel={() => setPendingSuspendGymId(null)}
        title="Suspend Gym?"
        itemName={gyms.find(g => g.id === pendingSuspendGymId)?.name ?? ""}
        warning="Members will not be able to check in at this gym. Existing memberships, staff, and data will be preserved. You can reactivate the gym at any time."
        confirmLabel="Suspend"
        danger={false}
      />
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   LOCATION STAT DETAIL PANEL
   ════════════════════════════════════════════ */
function LocationStatDetailPanel({
  statKey, gyms, activeGyms, suspendedGyms, dashboard, onClose, onViewDetail,
}: {
  statKey: StatKey; gyms: GymRow[]; activeGyms: number; suspendedGyms: number;
  dashboard: OrganizationOwnerDashboard; onClose: () => void;
  onViewDetail: (gym: GymRow) => void;
}) {
  const [search, setSearch] = useState("");

  const titleByKey: Record<string, string> = {
    all: "All Gyms",
    active: "Active Gyms",
    suspended: "Suspended Gyms",
  };

  const iconByKey: Record<string, ReactNode> = {
    all: <Building2 className="size-5" />,
    active: <CheckCircle2 className="size-5" />,
    suspended: <ShieldAlert className="size-5" />,
  };

  const list =
    statKey === "all" ? gyms :
    statKey === "active" ? gyms.filter((g) => g.status === "active") :
    statKey === "suspended" ? gyms.filter((g) => g.status === "suspended") :
    [];

  const filtered = list.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (!statKey) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={titleByKey[statKey]}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              {iconByKey[statKey]}
            </div>
            <div>
              <h2 className="text-xl font-black">{titleByKey[statKey]}</h2>
              <p className="text-sm text-muted-foreground">
                {filtered.length} gym{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-all" onClick={onClose} type="button" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              placeholder="Search gyms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((g) => {
              const gymMembers = dashboard.members.filter((m) => m.gym_id === g.id);
              const gymRevenue = dashboard.payments
                .filter((p) => p.status === "paid" && p.gym_id === g.id)
                .reduce((s, p) => s + Number(p.amount ?? 0), 0);

              return (
                <div key={g.id} className="group rounded-lg border border-border bg-background p-4 transition-all hover:border-accent/30 hover:shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Building2 className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.slug}</p>
                      </div>
                    </div>
                    <EnterpriseStatusBadge status={g.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-surface-muted p-2 text-center">
                      <p className="font-black text-muted-foreground">Members</p>
                      <p className="font-bold">{gymMembers.length}</p>
                    </div>
                    <div className="rounded-md bg-surface-muted p-2 text-center">
                      <p className="font-black text-muted-foreground">Revenue</p>
                      <p className="font-bold">{formatCompactNumber(Math.round(gymRevenue))}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button onClick={() => onViewDetail(g)} className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-all hover:bg-surface-muted" type="button">View Details</button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-2 rounded-lg border border-dashed border-border bg-surface-muted p-12 text-center">
                <Search className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No gyms match your search.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
