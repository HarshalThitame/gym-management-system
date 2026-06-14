"use client";

import { useCallback, useState, useActionState, useRef } from "react";
import { Building2, Edit3, Loader2, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveGymAction, setGymStatusAction } from "@/features/organization-owner/actions/gym-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { showToast } from "@/components/ui/toast";
import type { GymRow } from "@/types/enterprise";

type GymsModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: GymRow[]; total: number; page: number; pageSize: number; totalPages: number };
  moduleFilters?: Record<string, unknown>;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function GymsModule({ dashboard, moduleData, moduleFilters }: GymsModuleProps) {
  const [page, setPage] = useState(moduleData?.page ?? 1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGym, setEditingGym] = useState<GymRow | null>(null);
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [filters, setFilters] = useState<Record<string, string>>((moduleFilters ?? {}) as unknown as unknown as Record<string, string>);
  const [state, formAction] = useActionState(saveGymAction, initialAuthActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const initialItems = ((moduleData?.items ?? dashboard.gyms) as GymRow[]);
  const { items: gyms, addOptimistic, updateOptimistic, removeOptimistic } = useOptimisticList<GymRow>(initialItems);
  const branches = dashboard.branches;

  const openCreate = useCallback(() => {
    setEditingGym(null);
    setSavingStatus("idle");
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((gym: GymRow) => {
    setEditingGym(gym);
    setSavingStatus("idle");
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingGym(null);
    setSavingStatus("idle");
  }, []);

  const handleOptimisticSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    if (!name) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticGym: GymRow = {
      id: tempId,
      name,
      slug: (formData.get("slug") as string) || name.toLowerCase().replace(/\s+/g, "-"),
      timezone: (formData.get("timezone") as string) || "Asia/Kolkata",
      currency: (formData.get("currency") as string) || "INR",
      status: (formData.get("status") as "active" | "suspended" | "archived") || "active",
      organization_id: dashboard.organization.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    addOptimistic(optimisticGym);
    setSavingStatus("saving");
    closeDrawer();
    showToast("Saving gym...", "info");

    const fd = new FormData(form);
    const result = await saveGymAction({ status: "idle", message: null } as never, fd);
    if (result.status === "success") {
      removeOptimistic(tempId);
      showToast("Gym saved successfully", "success");
    } else {
      removeOptimistic(tempId);
      showToast(result.message || "Failed to save gym", "error");
    }
    setSavingStatus("idle");
  }, [addOptimistic, removeOptimistic, closeDrawer, dashboard.organization.id]);

  const handleSetStatus = useCallback(async (gymId: string, status: "active" | "suspended" | "archived") => {
    updateOptimistic(gymId, { status });
    const fd = new FormData();
    fd.set("gymId", gymId);
    fd.set("status", status);
    const result = await setGymStatusAction({ status: "idle", message: null } as never, fd);
    if (result.status !== "success") {
      updateOptimistic(gymId, { status: dashboard.gyms.find((g) => g.id === gymId)?.status ?? "active" });
      showToast(result.message || "Failed to update gym", "error");
    } else {
      showToast(`Gym ${status}`, "success");
    }
  }, [updateOptimistic, dashboard.gyms]);

  const handleApplyFilters = useCallback((f: Record<string, string>) => {
    setFilters(f);
    setPage(1);
  }, []);

  const items = gyms.map((gym) => ({
    id: gym.id,
    title: gym.name,
    subtitle: `Slug: ${gym.slug}`,
    meta: `Timezone: ${gym.timezone} · Currency: ${gym.currency} · Created: ${new Date(gym.created_at).toLocaleDateString("en-IN")}`,
    badge: gym.status === "active" ? "Active" : gym.status === "suspended" ? "Suspended" : "Archived",
    badgeVariant: (gym.status === "active" ? "success" : gym.status === "suspended" ? "warning" : "neutral") as "success" | "warning" | "neutral",
    status: gym.status,
    sections: [
      { label: "Branches", value: branches.filter((b) => b.gym_id === gym.id).length },
      { label: "Timezone", value: gym.timezone },
      { label: "Currency", value: gym.currency },
      { label: "Status", value: gym.status }
    ],
    actions: [
      { label: "Edit", onClick: () => openEdit(gym), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
      ...(gym.status === "active"
        ? [{ label: "Suspend", onClick: () => handleSetStatus(gym.id, "suspended"), variant: "destructive" as const, icon: <ShieldAlert className="size-3.5" /> }]
        : gym.status === "suspended"
        ? [{ label: "Activate", onClick: () => handleSetStatus(gym.id, "active"), variant: "primary" as const, icon: <ShieldCheck className="size-3.5" /> }]
        : [])
    ]
  }));

  return (
    <div className="space-y-6">
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "archived", label: "Archived" }
          ]}
        ]}
        searchPlaceholder="Search by gym name or slug..."
        onApply={handleApplyFilters}
      />

      <DataList
        headerAction={
          <Button onClick={openCreate} size="sm" variant="primary">
            <Plus className="size-4" /> Create Gym
          </Button>
        }
        headerTitle="Gyms"
        items={items}
        totalItems={moduleData?.total ?? gyms.length}
        totalPages={moduleData?.totalPages ?? Math.ceil(gyms.length / 12)}
        currentPage={page}
        onPageChange={setPage}
        pageSize={12}
      />

      <OrgOwnerDrawer
        description={editingGym ? `Editing ${editingGym.name}` : "Create a new gym under your organization"}
        onClose={closeDrawer}
        open={drawerOpen}
        title={editingGym ? "Edit Gym" : "Create Gym"}
        size="lg"
      >
        <form ref={formRef} onSubmit={handleOptimisticSubmit} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />

          {editingGym ? <input name="gymId" type="hidden" value={editingGym.id} /> : null}

          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym Name" required>
              <input
                className={selectClass}
                defaultValue={editingGym?.name ?? ""}
                name="name"
                placeholder="Apex Fitness Mumbai"
                required
                type="text"
              />
            </DrawerField>
            <DrawerField label="Slug">
              <input
                className={selectClass}
                defaultValue={editingGym?.slug ?? ""}
                name="slug"
                placeholder="apex-fitness-mumbai"
                type="text"
              />
            </DrawerField>
            <DrawerField label="Timezone">
              <input
                className={selectClass}
                defaultValue={editingGym?.timezone ?? "Asia/Kolkata"}
                name="timezone"
                type="text"
              />
            </DrawerField>
            <DrawerField label="Currency">
              <input
                className={selectClass}
                defaultValue={editingGym?.currency ?? "INR"}
                name="currency"
                maxLength={3}
                type="text"
              />
            </DrawerField>
            <DrawerField label="Status">
              <select
                className={selectClass}
                defaultValue={editingGym?.status ?? "active"}
                name="status"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </select>
            </DrawerField>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button
              className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong"
              onClick={closeDrawer}
              type="button"
            >
              Cancel
            </button>
            <DrawerSubmitButton loading={savingStatus === "saving"}>{editingGym ? "Update Gym" : "Create Gym"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
