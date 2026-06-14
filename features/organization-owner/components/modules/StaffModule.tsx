"use client";

import { useCallback, useState, useActionState } from "react";
import { Ban, Plus, UserPlus } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { inviteStaffAction, deactivateStaffAction } from "@/features/organization-owner/actions/staff-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type StaffModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: Record<string, unknown>[] };
  moduleFilters?: Record<string, unknown>;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function toStaffItem(bu: Record<string, unknown>) {
  const profile = bu.profiles as { full_name?: string; email?: string } | null;
  return {
    id: bu.id as string,
    userId: bu.user_id as string,
    roleName: bu.role_name as string,
    branchId: bu.branch_id as string | null,
    status: bu.status as string,
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? null,
    updatedAt: bu.updated_at as string
  };
}

export function StaffModule({ dashboard, moduleData }: StaffModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction] = useActionState(inviteStaffAction, initialAuthActionState);

  const initialItems = ((moduleData?.items ?? dashboard.branchUsers) as Record<string, unknown>[]).map(toStaffItem);
  const { items: staffItems, addOptimistic, removeOptimistic } = useOptimisticList(initialItems);

  const openInvite = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleApplyFilters = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, role: f.role, status: f.status });
  }, [navigate]);

  const handleDeactivate = useCallback(async (userId: string) => {
    removeOptimistic(userId);
    const fd = new FormData();
    fd.set("userId", userId);
    const result = await deactivateStaffAction({ status: "idle", message: null } as never, fd);
    if (result.status !== "success") {
      showToast(result.message || "Failed to deactivate", "error");
    } else {
      showToast("Staff deactivated", "success");
    }
  }, [removeOptimistic]);

  const items = staffItems.map((item) => ({
    id: item.id,
    title: item.fullName ?? formatEnterpriseLabel(item.roleName),
    subtitle: item.email ?? undefined,
    meta: `Branch: ${dashboard.branches.find((b) => b.id === item.branchId)?.name ?? "N/A"}`,
    badge: item.status,
    badgeVariant: (item.status === "active" ? "success" : item.status === "invited" ? "info" : "neutral") as "success" | "info" | "neutral",
    status: item.status,
    sections: [
      { label: "Role", value: formatEnterpriseLabel(item.roleName) },
      { label: "Email", value: item.email ?? "—" },
      { label: "Branch", value: dashboard.branches.find((b) => b.id === item.branchId)?.name ?? "—" },
      { label: "Status", value: item.status }
    ],
    actions: item.status === "active" ? [
      { label: "Deactivate", onClick: () => handleDeactivate(item.userId), variant: "destructive" as const, icon: <Ban className="size-3.5" /> }
    ] : []
  }));

  const totalItems = moduleData?.items?.length ?? dashboard.branchUsers.length;

  return (
    <div className="space-y-6">
      <FilterBar
        filterGroups={[
          { key: "role", label: "Role", options: [
            { value: "gym_admin", label: "Gym Admin" },
            { value: "reception_staff", label: "Reception" },
            { value: "trainer", label: "Trainer" }
          ]},
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "invited", label: "Invited" },
            { value: "suspended", label: "Suspended" }
          ]}
        ]}
        searchPlaceholder="Search staff by name, email, or role..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as unknown as Record<string, string>}
      />

      <DataList
        headerAction={
          <Button onClick={openInvite} size="sm" variant="primary">
            <UserPlus className="size-4" /> Invite Staff
          </Button>
        }
        headerTitle="Staff"
        items={items}
        totalItems={totalItems}
        totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={filters.pageSize ?? 12}
      />

      <OrgOwnerDrawer
        description="Invite a new staff member to your organization"
        onClose={closeDrawer}
        open={drawerOpen}
        title="Invite Staff"
        size="lg"
      >
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Email Address" required>
              <input className={selectClass} name="email" placeholder="staff@example.com" required type="email" />
            </DrawerField>
            <DrawerField label="Full Name" required>
              <input className={selectClass} name="fullName" placeholder="John Doe" required type="text" />
            </DrawerField>
            <DrawerField label="Phone">
              <input className={selectClass} name="phone" placeholder="+91 98765 43210" type="text" />
            </DrawerField>
            <DrawerField label="Role" required>
              <select className={selectClass} defaultValue="" name="roleName" required>
                <option value="">Select role</option>
                <option value="gym_admin">Gym Admin</option>
                <option value="reception_staff">Reception Staff</option>
                <option value="trainer">Trainer</option>
              </select>
            </DrawerField>
            <DrawerField label="Gym" required>
              <select className={selectClass} defaultValue="" name="gymId" required>
                <option value="">Select gym</option>
                {dashboard.gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Branch">
              <select className={selectClass} defaultValue="" name="branchId">
                <option value="">All branches</option>
                {dashboard.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Access Scope">
              <select className={selectClass} defaultValue="single_branch" name="accessScope">
                <option value="single_branch">Single Branch</option>
                <option value="multi_branch">Multi Branch</option>
                <option value="organization">Organization</option>
              </select>
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Send Invite</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
