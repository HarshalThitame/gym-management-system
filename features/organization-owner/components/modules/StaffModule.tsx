"use client";

import { useCallback, useState, useActionState } from "react";
import { Ban, Download, Edit3, Mail, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { inviteStaffAction, deactivateStaffAction } from "@/features/organization-owner/actions/staff-actions";
import { bulkDeactivateStaffAction } from "@/features/organization-owner/actions/bulk-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { showToast } from "@/components/ui/toast";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type StaffModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: Record<string, unknown>[] };
  moduleFilters?: Record<string, unknown>;
};

type StaffItem = {
  id: string;
  userId: string;
  roleName: string;
  branchId: string | null;
  gymId: string | null;
  status: string;
  fullName: string | null;
  email: string | null;
  accessScope: string;
  branchRole: string;
  updatedAt: string;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function toStaffItem(bu: Record<string, unknown>, branches: Array<{ id: string; gym_id: string | null; name: string }>) {
  const profile = bu.profiles as { full_name?: string; email?: string } | null;
  const branchId = bu.branch_id as string | null;
  const branch = branchId ? branches.find((b) => b.id === branchId) : null;
  return {
    id: bu.id as string,
    userId: bu.user_id as string,
    roleName: bu.role_name as string,
    branchId,
    gymId: branch?.gym_id ?? null,
    status: bu.status as string,
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? null,
    accessScope: bu.access_scope as string ?? "single_branch",
    branchRole: bu.branch_role as string ?? "staff",
    updatedAt: bu.updated_at as string
  };
}

function StaffAvatar({ name, email }: { name: string | null; email: string | null }) {
  const initial = (name ?? email ?? "?").charAt(0).toUpperCase();
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500"];
  const colorIndex = (name ?? email ?? "").length % colors.length;
  return (
    <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colors[colorIndex]}`}>
      {initial}
    </div>
  );
}

export function StaffModule({ dashboard, moduleData }: StaffModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [inviteState, inviteFormAction] = useActionState(inviteStaffAction, initialAuthActionState);

  const initialItems = ((moduleData?.items ?? dashboard.branchUsers) as Record<string, unknown>[]).map((bu) => toStaffItem(bu, dashboard.branches));
  const { items: staffItems, addOptimistic, removeOptimistic } = useOptimisticList(initialItems);

  // ── KPIs ──
  const activeCount = staffItems.filter((s) => s.status === "active").length;
  const invitedCount = staffItems.filter((s) => s.status === "invited").length;
  const gymAdminCount = staffItems.filter((s) => s.roleName === "gym_admin").length;
  const receptionCount = staffItems.filter((s) => s.roleName === "reception_staff").length;
  const trainerCount = staffItems.filter((s) => s.roleName === "trainer").length;

  const openInvite = useCallback(() => { setEditingStaff(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((item: StaffItem) => { setEditingStaff(item); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingStaff(null); }, []);

  const handleApplyFilters = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, role: f.role, status: f.status, gymId: f.gymId });
  }, [navigate]);

  const handleDeactivate = useCallback(async (userId: string) => {
    removeOptimistic(userId);
    const fd = new FormData(); fd.set("userId", userId);
    const r = await deactivateStaffAction({ status: "idle", message: null } as never, fd);
    if (r.status !== "success") showToast(r.message || "Failed", "error");
    else showToast("Staff deactivated", "success");
  }, [removeOptimistic]);

  const handleBulkDeactivate = useCallback(async (ids: string[]) => {
    const fd = new FormData(); fd.set("staffIds", ids.join(","));
    const r = await bulkDeactivateStaffAction({ status: "idle" }, fd);
    showToast(r.message || "Done", r.status === "success" ? "success" : "error");
    ids.forEach((id) => removeOptimistic(id));
  }, [removeOptimistic]);

  const items = staffItems.map((item) => {
    const branch = dashboard.branches.find((b) => b.id === item.branchId);
    const gym = branch ? dashboard.gyms.find((g) => g.id === branch.gym_id) : null;
    const isInvited = item.status === "invited";

    return {
      id: item.id,
      title: item.fullName ?? formatEnterpriseLabel(item.roleName),
      subtitle: item.email ?? undefined,
      meta: `${gym?.name ?? "Unknown gym"} · ${branch?.name ?? "All branches"}${isInvited ? " · Invitation pending" : ` · Last activity: ${new Date(item.updatedAt).toLocaleDateString("en-IN")}`}`,
      badge: item.status,
      badgeVariant: (item.status === "active" ? "success" : item.status === "invited" ? "info" : "neutral") as "success" | "info" | "neutral",
      status: item.status,
      avatar: <StaffAvatar name={item.fullName} email={item.email} />,
      sections: [
        { label: "Role", value: formatEnterpriseLabel(item.roleName) },
        { label: "Branch Role", value: formatEnterpriseLabel(item.branchRole) },
        { label: "Access Scope", value: formatEnterpriseLabel(item.accessScope) },
        { label: "Gym", value: gym?.name ?? "—" },
      ],
      actions: [
        { label: "Edit", onClick: () => openEdit(item), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
        ...(item.status === "active"
          ? [{ label: "Deactivate", onClick: () => handleDeactivate(item.userId), variant: "destructive" as const, icon: <Ban className="size-3.5" /> }]
          : isInvited
          ? [{ label: "Resend Invite", onClick: () => showToast("Invitation resent", "success"), variant: "secondary" as const, icon: <Mail className="size-3.5" /> }]
          : item.status === "suspended"
          ? [{ label: "Reactivate", onClick: () => showToast("Reactivate request submitted", "info"), variant: "primary" as const, icon: <ShieldCheck className="size-3.5" /> }]
          : []
        )
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? dashboard.branchUsers.length;

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total staff across all branches" icon={<UsersRound className="size-5" />} label="Total Staff" value={String(staffItems.length)} />
        <StatCard detail="Active staff members" icon={<ShieldCheck className="size-5" />} label="Active" value={String(activeCount)} />
        <StatCard detail="Gym administrators" icon={<ShieldCheck className="size-5" />} label="Branch Managers" value={String(gymAdminCount)} />
        <StatCard detail="Pending invitations" icon={<Mail className="size-5" />} label="Invited" value={String(invitedCount)} />
        <StatCard detail="Front desk staff" icon={<UsersRound className="size-5" />} label="Reception" value={String(receptionCount)} />
        <StatCard detail="Fitness trainers" icon={<UsersRound className="size-5" />} label="Trainers" value={String(trainerCount)} />
      </section>

      {/* ═══ FILTERS ═══ */}
      <FilterBar
        filterGroups={[
          { key: "role", label: "Role", options: [
            { value: "gym_admin", label: "Branch Manager" }, { value: "reception_staff", label: "Reception" }, { value: "trainer", label: "Trainer" }
          ]},
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "suspended", label: "Suspended" }
          ]},
          { key: "gymId", label: "Branch", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
        ]}
        searchPlaceholder="Search by name, email, or role..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as Record<string, string>}
      />

      {/* ═══ DATA LIST ═══ */}
      <DataList
        selectable
        bulkActions={[
          { label: "Deactivate", onClick: handleBulkDeactivate, variant: "destructive" as const, icon: <Ban className="size-3.5" /> },
          { label: "Export CSV", onClick: (ids) => {
            const data = staffItems.filter((s) => ids.includes(s.id)).map((s) => ({ name: s.fullName, email: s.email, role: s.roleName, status: s.status }));
            exportToCSV(data, "staff-export");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(staffItems.map((s) => ({ name: s.fullName, email: s.email, role: s.roleName, status: s.status, scope: s.accessScope })), "all-staff")}
        headerAction={<Button onClick={openInvite} size="sm" variant="primary"><UserPlus className="size-4" /> Invite Staff</Button>}
        headerTitle="Staff"
        items={items}
        totalItems={totalItems}
        totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ INVITE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer
        description={editingStaff ? `Editing ${editingStaff.fullName ?? editingStaff.roleName}` : "Invite a new staff member"}
        onClose={closeDrawer}
        open={drawerOpen}
        title={editingStaff ? "Edit Staff" : "Invite Staff"}
        size="lg"
      >
        <form action={inviteFormAction} className="space-y-5">
          <DrawerFormMessage status={inviteState.status} message={inviteState.message} />
          {editingStaff ? <input name="userId" type="hidden" value={editingStaff.userId} /> : null}

          <div className="flex items-center gap-4 mb-6">
            {editingStaff ? <StaffAvatar name={editingStaff.fullName} email={editingStaff.email} /> : null}
            <div>
              <p className="text-lg font-bold">{editingStaff ? editingStaff.fullName : "New Staff Member"}</p>
              {editingStaff ? <p className="text-sm text-muted-foreground">{editingStaff.email} · {formatEnterpriseLabel(editingStaff.roleName)}</p> : null}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Email Address" required>
              <input className={selectClass} defaultValue={editingStaff?.email ?? ""} name="email" placeholder="staff@example.com" required type="email" />
            </DrawerField>
            <DrawerField label="Full Name" required>
              <input className={selectClass} defaultValue={editingStaff?.fullName ?? ""} name="fullName" placeholder="John Doe" required type="text" />
            </DrawerField>
            <DrawerField label="Phone">
              <input className={selectClass} name="phone" placeholder="+91 98765 43210" type="text" />
            </DrawerField>
            <DrawerField label="Role" required>
              <select className={selectClass} defaultValue={editingStaff?.roleName ?? ""} name="roleName" required>
                <option value="">Select role</option>
                <option value="gym_admin">Branch Manager</option>
                <option value="reception_staff">Reception Staff</option>
                <option value="trainer">Trainer</option>
              </select>
            </DrawerField>
            <DrawerField label="Branch" required>
              <select className={selectClass} defaultValue={editingStaff?.gymId ?? ""} name="gymId" required>
                <option value="">Select gym</option>
                {dashboard.gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Branch">
              <select className={selectClass} defaultValue={editingStaff?.branchId ?? ""} name="branchId">
                <option value="">All branches</option>
                {dashboard.branches.filter((b) => !editingStaff || b.gym_id === editingStaff.gymId).map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </DrawerField>
            <DrawerField label="Access Scope">
              <select className={selectClass} defaultValue={editingStaff?.accessScope ?? "single_branch"} name="accessScope">
                <option value="single_branch">Single Branch</option>
                <option value="multi_branch">Multi Branch</option>
                <option value="organization">Organization</option>
              </select>
            </DrawerField>
            <DrawerField label="Branch Role">
              <select className={selectClass} defaultValue={editingStaff?.branchRole ?? "staff"} name="branchRole">
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="trainer">Trainer</option>
                <option value="viewer">Viewer</option>
              </select>
            </DrawerField>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingStaff ? "Save Changes" : "Send Invite"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
