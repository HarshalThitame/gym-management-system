"use client";

import { useCallback, useMemo, useState, useActionState, useEffect, useRef, type ReactNode } from "react";
import { Ban, Download, Edit3, Mail, ShieldCheck, UserPlus, UsersRound, Clock, ArrowLeftRight, FileText } from "lucide-react";
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
import { useHasFeature } from "@/features/organization-owner/entitlements/entitlement-provider";
import { GenericConfirmDialog } from "@/features/organization-owner/components/modules/GenericConfirmDialog";
import { GenericSuccessDialog, type SuccessDetail } from "@/features/organization-owner/components/modules/GenericSuccessDialog";
import { StaffAttendancePanel } from "@/features/organization-owner/components/modules/StaffAttendancePanel";
import { StaffLeavePanel } from "@/features/organization-owner/components/modules/StaffLeavePanel";
import { StaffBranchAssignmentPanel } from "@/features/organization-owner/components/modules/StaffBranchAssignmentPanel";
import { HRDocumentsPanel } from "@/features/organization-owner/components/modules/HRDocumentsPanel";
import { CustomRoleAssignmentPanel } from "@/features/organization-owner/components/modules/CustomRoleAssignmentPanel";
import { cn } from "@/lib/utils";

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
  const hasAttendanceLeave = useHasFeature("staff_attendance_leave");
    const hasMultiBranch = useHasFeature("multi_branch_staff_assignment");
    const hasHRDocs = useHasFeature("hr_document_storage");
    const hasCustomRoles = useHasFeature("custom_roles_granular_permissions");
    const [activeTab, setActiveTab] = useState<"staff" | "attendance" | "leave" | "branchAccess" | "documents" | "customRoles">("staff");
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedCustomRoleIds, setSelectedCustomRoleIds] = useState<string[]>([]);
  const [availableCustomRoles, setAvailableCustomRoles] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);

  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);

  // ── Premium dialog state ──
  const [confirmDialog, setConfirmDialog] = useState<{
    staff: StaffItem;
    action: "deactivate" | "reactivate";
  } | null>(null);
  const [bulkConfirmIds, setBulkConfirmIds] = useState<string[] | null>(null);
  const [successDialog, setSuccessDialog] = useState<{
    action: "created" | "updated";
    staff: StaffItem;
  } | null>(null);
  const inviteSuccessRef = useRef(false);

  // Fetch custom roles when drawer opens (if feature enabled)
  useEffect(() => {
    if (drawerOpen && hasCustomRoles && !editingStaff) {
      import("@/features/organization-owner/actions/custom-roles-actions").then((m) => {
        m.getCustomRoles(dashboard.organization.id).then((roles) => {
          setAvailableCustomRoles(roles.map((r) => ({ id: r.id, name: r.name, description: r.description })));
        });
      });
    }
  }, [drawerOpen, hasCustomRoles, editingStaff, dashboard.organization.id]);

  const [inviteState, inviteFormAction] = useActionState(inviteStaffAction, initialAuthActionState);
  const [userCustomRoleNames, setUserCustomRoleNames] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!hasCustomRoles) return;
    import("@/features/organization-owner/actions/custom-roles-actions").then((m) => {
      m.getBulkUserCustomRoles(dashboard.organization.id).then(setUserCustomRoleNames).catch(() => {});
    });
  }, [hasCustomRoles, dashboard.organization.id]);

  const initialItems = ((moduleData?.items ?? dashboard.branchUsers) as Record<string, unknown>[]).map((bu) => toStaffItem(bu, dashboard.branches));
  const { items: staffItems, removeOptimistic } = useOptimisticList(initialItems);

  // ── KPIs ──
  const activeCount = staffItems.filter((s) => s.status === "active").length;
  const invitedCount = staffItems.filter((s) => s.status === "invited").length;
  const gymAdminCount = staffItems.filter((s) => s.roleName === "gym_admin").length;
  const receptionCount = staffItems.filter((s) => s.roleName === "reception_staff").length;
  const trainerCount = staffItems.filter((s) => s.roleName === "trainer").length;

  const openInvite = useCallback(() => { setEditingStaff(null); setSelectedCustomRoleIds([]); inviteSuccessRef.current = false; setDrawerOpen(true); }, []);
  const openEdit = useCallback((item: StaffItem) => { setEditingStaff(item); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingStaff(null); setSelectedCustomRoleIds([]); }, []);

  const handleApplyFilters = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, role: f.role, status: f.status, gymId: f.gymId });
  }, [navigate]);

  const handleDeactivate = useCallback(async (userId: string) => {
    const staff = staffItems.find((s) => s.userId === userId);
    if (!staff) return;
    setConfirmDialog({ staff, action: "deactivate" });
  }, [staffItems]);

  const executeDeactivate = useCallback(async (userId: string) => {
    const staff = staffItems.find((s) => s.userId === userId);
    setConfirmDialog(null);
    removeOptimistic(userId);
    const fd = new FormData(); fd.set("userId", userId);
    const r = await deactivateStaffAction({ status: "idle", message: null } as never, fd);
    if (r.status !== "success") {
      showToast(r.message || "Failed", "error");
    } else {
      const s = staff!;
      setSuccessDialog({
        action: "updated",
        staff: s,
      });
    }
  }, [staffItems, removeOptimistic]);

  const handleBulkDeactivate = useCallback(async (ids: string[]) => {
    setBulkConfirmIds(ids);
  }, []);

  const executeBulkDeactivate = useCallback(async () => {
    const ids = bulkConfirmIds;
    setBulkConfirmIds(null);
    if (!ids || ids.length === 0) return;
    const fd = new FormData(); fd.set("staffIds", ids.join(","));
    const r = await bulkDeactivateStaffAction({ status: "idle" }, fd);
    showToast(r.message || "Done", r.status === "success" ? "success" : "error");
    ids.forEach((id) => removeOptimistic(id));
  }, [bulkConfirmIds, removeOptimistic]);

  const items = staffItems.map((item) => {
    const branch = dashboard.branches.find((b) => b.id === item.branchId);
    const gym = branch ? dashboard.gyms.find((g) => g.id === branch.gym_id) : null;
    const isInvited = item.status === "invited";

    return {
      id: item.id,
      title: item.fullName ?? formatEnterpriseLabel(item.roleName),
      subtitle: item.email ?? undefined,
      meta: `${gym?.name ?? "Unknown gym"}${isInvited ? " · Invitation pending" : ` · Last activity: ${new Date(item.updatedAt).toLocaleDateString("en-IN")}`}`,
      badge: item.status,
      badgeVariant: (item.status === "active" ? "success" : item.status === "invited" ? "info" : "neutral") as "success" | "info" | "neutral",
      status: item.status,
      avatar: <StaffAvatar name={item.fullName} email={item.email} />,
      sections: [
        { label: "Role", value: formatEnterpriseLabel(item.roleName) },
        ...(hasCustomRoles && (userCustomRoleNames[item.userId]?.length ?? 0) > 0
          ? [{ label: "Custom Roles", value: userCustomRoleNames[item.userId]!.join(", ") }]
          : []),
        { label: "Gym Role", value: formatEnterpriseLabel(item.branchRole) },
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
          ? [{ label: "Reactivate", onClick: () => setConfirmDialog({ staff: item, action: "reactivate" }), variant: "primary" as const, icon: <ShieldCheck className="size-3.5" /> }]
          : []
        )
      ]
    };
  });

  const tabs = useMemo(() => {
    const t: Array<{ key: typeof activeTab; label: string; icon: ReactNode }> = [
      { key: "staff", label: "Staff", icon: <UsersRound className="size-4" /> },
    ];
    if (hasAttendanceLeave) {
      t.push({ key: "attendance", label: "Attendance", icon: <Clock className="size-4" /> });
      t.push({ key: "leave", label: "Leave", icon: <Mail className="size-4" /> });
    }
    if (hasMultiBranch) {
      t.push({ key: "branchAccess", label: "Gym Access", icon: <ArrowLeftRight className="size-4" /> });
    }
    if (hasHRDocs) {
      t.push({ key: "documents", label: "Documents", icon: <FileText className="size-4" /> });
    }
    if (hasCustomRoles) {
      t.push({ key: "customRoles", label: "Custom Roles", icon: <ShieldCheck className="size-4" /> });
    }
    return t;
  }, [hasAttendanceLeave, hasMultiBranch, hasHRDocs, hasCustomRoles]);

  // When invite succeeds, show the premium success dialog and close drawer
  useEffect(() => {
    if (inviteState.status === "success" && !inviteSuccessRef.current) {
      inviteSuccessRef.current = true;
      closeDrawer();
      const newStaff: StaffItem = {
        id: "",
        userId: "",
        roleName: (document.querySelector("[name='roleName']") as HTMLSelectElement)?.value ?? "",
        branchId: null,
        gymId: (document.querySelector("[name='gymId']") as HTMLSelectElement)?.value ?? null,
        status: "active",
        fullName: (document.querySelector("[name='fullName']") as HTMLInputElement)?.value ?? null,
        email: (document.querySelector("[name='email']") as HTMLInputElement)?.value ?? null,
        accessScope: "single_branch",
        branchRole: "staff",
        updatedAt: new Date().toISOString(),
      };
      setSuccessDialog({ action: "created", staff: newStaff });
    }
  }, [inviteState.status]);

  const totalItems = moduleData?.items?.length ?? dashboard.branchUsers.length;

  return (
    <div className="space-y-6">
      {/* ═══ SUB-TABS ═══ */}
      {tabs.length > 1 ? (
        <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ═══ ATTENDANCE PANEL ═══ */}
      {activeTab === "attendance" ? <StaffAttendancePanel dashboard={dashboard} /> : null}

      {/* ═══ LEAVE PANEL ═══ */}
      {activeTab === "leave" ? <StaffLeavePanel dashboard={dashboard} /> : null}

      {/* ═══ BRANCH ACCESS PANEL ═══ */}
      {activeTab === "branchAccess" ? <StaffBranchAssignmentPanel dashboard={dashboard} hasFeature={hasMultiBranch} /> : null}

      {/* ═══ DOCUMENTS PANEL ═══ */}
      {activeTab === "documents" ? <HRDocumentsPanel dashboard={dashboard} hasFeature={hasHRDocs} /> : null}

      {/* ═══ CUSTOM ROLES PANEL ═══ */}
      {activeTab === "customRoles" ? <CustomRoleAssignmentPanel dashboard={dashboard} hasFeature={hasCustomRoles} /> : null}

      {/* ═══ STAFF TAB (DEFAULT) ═══ */}
      {activeTab !== "staff" ? null : (
        <>
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total staff across all branches" icon={<UsersRound className="size-5" />} label="Total Staff" value={String(staffItems.length)} />
        <StatCard detail="Active staff members" icon={<ShieldCheck className="size-5" />} label="Active" value={String(activeCount)} />
        <StatCard detail="Gym administrators" icon={<ShieldCheck className="size-5" />} label="Gym Managers" value={String(gymAdminCount)} />
        <StatCard detail="Pending invitations" icon={<Mail className="size-5" />} label="Invited" value={String(invitedCount)} />
        <StatCard detail="Front desk staff" icon={<UsersRound className="size-5" />} label="Reception" value={String(receptionCount)} />
        <StatCard detail="Fitness trainers" icon={<UsersRound className="size-5" />} label="Trainers" value={String(trainerCount)} />
      </section>

      {/* ═══ FILTERS ═══ */}
      <FilterBar
        filterGroups={[
          { key: "role", label: "Role", options: [
            { value: "gym_admin", label: "Gym Manager" }, { value: "reception_staff", label: "Reception" }, { value: "trainer", label: "Trainer" }
          ]},
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "suspended", label: "Suspended" }
          ]},
          { key: "gymId", label: "Gym", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
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
                <option value="gym_admin">Gym Manager</option>
                <option value="reception_staff">Reception Staff</option>
                <option value="trainer">Trainer</option>
              </select>
            </DrawerField>
            <DrawerField label="Gym" required>
              <select className={selectClass} defaultValue={editingStaff?.gymId ?? ""} name="gymId" required>
                <option value="">Select gym</option>
                {dashboard.gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Gyms (Multi-Assign)">
              {!editingStaff && hasMultiBranch ? (
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border border-border bg-surface-muted p-3">
                  {dashboard.branches.map((branch) => {
                    const gym = dashboard.gyms.find((g) => g.id === branch.gym_id);
                    return (
                      <label key={branch.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          className="size-4 rounded border-border text-primary focus:ring-primary"
                          name="branchIds"
                          type="checkbox"
                          value={branch.id}
                          checked={selectedBranchIds.includes(branch.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedBranchIds((prev) => [...prev, branch.id]);
                            else setSelectedBranchIds((prev) => prev.filter((id) => id !== branch.id));
                          }}
                        />
                        <span className="text-sm">{branch.name} {gym ? `(${gym.name})` : ""}</span>
                      </label>
                    );
                  })}
                  {selectedBranchIds.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Select at least one branch</p>
                  ) : null}
                </div>
              ) : (
                <select className={selectClass} defaultValue={editingStaff?.branchId ?? ""} name="branchId">
                  <option value="">All branches</option>
                  {dashboard.branches.filter((b) => !editingStaff || b.gym_id === editingStaff.gymId).map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              )}
            </DrawerField>
            <DrawerField label="Access Scope">
              <select className={selectClass} defaultValue={editingStaff?.accessScope ?? "single_branch"} name="accessScope">
                <option value="single_branch">Single Branch</option>
                <option value="multi_branch">Multi Branch</option>
                <option value="organization">Organization</option>
              </select>
            </DrawerField>
            <DrawerField label="Gym Role">
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

          {!editingStaff && hasCustomRoles && availableCustomRoles.length > 0 ? (
            <div className="space-y-3 rounded-md border border-border bg-surface-muted p-4">
              <p className="text-sm font-bold">Custom Roles</p>
              <p className="text-xs text-muted-foreground">Select custom roles to assign to this staff member. Each grants specific granular permissions.</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableCustomRoles.map((cr) => (
                  <label key={cr.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                      name="customRoleIds"
                      type="checkbox"
                      value={cr.id}
                      checked={selectedCustomRoleIds.includes(cr.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCustomRoleIds((prev) => [...prev, cr.id]);
                        else setSelectedCustomRoleIds((prev) => prev.filter((id) => id !== cr.id));
                      }}
                    />
                    <div>
                      <span className="text-sm">{cr.name}</span>
                      {cr.description ? <span className="ml-2 text-xs text-muted-foreground">{cr.description}</span> : null}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingStaff ? "Save Changes" : "Send Invite"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
        </>
      )}

      {/* ═══ PREMIUM DIALOGS ═══ */}

      {/* Deactivate single staff confirm */}
      {confirmDialog && confirmDialog.action === "deactivate" ? (
        <GenericConfirmDialog
          danger
          confirmLabel="Deactivate"
          itemName={confirmDialog.staff.fullName ?? confirmDialog.staff.email ?? "this staff member"}
          open
          title="Deactivate Staff"
          warning="This will revoke all access immediately. The staff member will no longer be able to log in or perform any actions. This action can be reversed by reactivating."
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => executeDeactivate(confirmDialog.staff.userId)}
        />
      ) : null}

      {/* Reactivate staff confirm */}
      {confirmDialog && confirmDialog.action === "reactivate" ? (
        <GenericConfirmDialog
          danger={false}
          confirmLabel="Reactivate"
          itemName={confirmDialog.staff.fullName ?? confirmDialog.staff.email ?? "this staff member"}
          open
          title="Reactivate Staff"
          warning="This will restore access for this staff member. They will be able to log in and perform actions based on their previous role and permissions."
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            setConfirmDialog(null);
            showToast(`${confirmDialog.staff.fullName ?? "Staff member"} reactivated`, "success");
          }}
        />
      ) : null}

      {/* Bulk deactivate confirm */}
      {bulkConfirmIds !== null ? (
        <GenericConfirmDialog
          danger
          confirmLabel={`Deactivate ${bulkConfirmIds.length} Staff`}
          itemName={`${bulkConfirmIds.length} staff members`}
          open
          title="Bulk Deactivate"
          warning={`You are about to deactivate ${bulkConfirmIds.length} staff members. They will lose all system access immediately.`}
          onCancel={() => setBulkConfirmIds(null)}
          onConfirm={executeBulkDeactivate}
        />
      ) : null}

      {/* Invite/Edit success dialog */}
      {successDialog ? (
        <GenericSuccessDialog
          action={successDialog.action}
          itemName={successDialog.staff.fullName ?? successDialog.staff.email ?? "Staff member"}
          open
          title={successDialog.action === "created" ? "Staff Invited Successfully" : "Staff Updated"}
          onClose={() => { setSuccessDialog(null); inviteSuccessRef.current = false; }}
          details={[
            { label: "Email", value: successDialog.staff.email ?? "—" },
            { label: "Role", value: formatEnterpriseLabel(successDialog.staff.roleName) },
            { label: "Status", value: "Active" },
          ] as SuccessDetail[]}
        />
      ) : null}
    </div>
  );
}
