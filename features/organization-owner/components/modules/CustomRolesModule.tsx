"use client";

import { useCallback, useMemo, useState, useEffect, useActionState } from "react";
import { Lock, Plus, Pencil, Trash2, UserPlus, ShieldCheck, CheckSquare, Square, UsersRound } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { createCustomRoleAction, updateCustomRoleAction, deleteCustomRoleAction, assignCustomRoleToUserAction, removeCustomRoleFromUserAction, type CustomRole } from "@/features/organization-owner/actions/custom-roles-actions";
import type { PermissionAction, AuthResource } from "@/types/auth";
import { authResources, permissionActions } from "@/types/auth";
import { cn } from "@/lib/utils";

type CustomRolesModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: CustomRole[] };
  moduleFilters?: ModuleSearchParams | undefined;
  hasFeature: boolean;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const textareaClass = "min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const resourceLabels: Record<AuthResource, string> = {
  users: "Users",
  roles: "Roles",
  profiles: "Profiles",
  members: "Members",
  trainers: "Trainers",
  membership_plans: "Membership Plans",
  memberships: "Memberships",
  payments: "Payments",
  attendance: "Attendance",
  classes: "Classes",
  class_bookings: "Class Bookings",
  leads: "Leads",
  notifications: "Notifications",
  reports: "Reports",
  settings: "Settings",
  organizations: "Organizations",
  branches: "Branches",
  feature_flags: "Feature Flags",
  licenses: "Licenses",
  compliance: "Compliance",
  backups: "Backups",
  system_health: "System Health",
  content: "Content",
  audit_logs: "Audit Logs",
};

const actionLabels: Record<PermissionAction, string> = {
  read: "Read",
  create: "Create",
  update: "Update",
  delete: "Delete",
  export: "Export",
  approve: "Approve",
};

function PermissionGrid({
  permissions,
  onChange,
}: {
  permissions: Record<string, string[]>;
  onChange: (p: Record<string, string[]>) => void;
}) {
  const toggleCell = useCallback(
    (resource: string, action: string) => {
      const current = permissions[resource] ?? [];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      const updated = { ...permissions };
      if (next.length > 0) updated[resource] = next;
      else delete updated[resource];
      onChange(updated);
    },
    [permissions, onChange]
  );

  const toggleRow = useCallback(
    (resource: string) => {
      const current = permissions[resource] ?? [];
      const allSelected = permissionActions.every((a) => current.includes(a));
      const updated = { ...permissions };
      if (allSelected) delete updated[resource];
      else updated[resource] = [...permissionActions];
      onChange(updated);
    },
    [permissions, onChange]
  );

  const toggleColumn = useCallback(
    (action: string) => {
      const updated = { ...permissions };
      const allSelected = authResources.every((r) => (permissions[r] ?? []).includes(action));
      for (const resource of authResources) {
        const current = permissions[resource] ?? [];
        if (allSelected) {
          const next = current.filter((a) => a !== action);
          if (next.length > 0) updated[resource] = next;
          else delete updated[resource];
        } else {
          if (!current.includes(action)) {
            updated[resource] = [...current, action];
          }
        }
      }
      onChange(updated);
    },
    [permissions, onChange]
  );

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            <th className="sticky left-0 bg-surface-muted px-3 py-2 text-left font-bold">Resource</th>
            {permissionActions.map((action) => (
              <th key={action} className="px-2 py-2 text-center">
                <button
                  type="button"
                  className="text-xs font-bold text-foreground hover:text-primary transition-colors"
                  onClick={() => toggleColumn(action)}
                >
                  {actionLabels[action]}
                </button>
              </th>
            ))}
            <th className="px-2 py-2 text-center">
              <button
                type="button"
                className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  const anySelected = authResources.some((r) => {
                    const cur = permissions[r] ?? [];
                    return cur.length > 0;
                  });
                  if (anySelected) onChange({});
                  else onChange(Object.fromEntries(authResources.map((r) => [r, [...permissionActions]])));
                }}
              >
                All
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {authResources.map((resource) => {
            const cur = permissions[resource] ?? [];
            return (
              <tr key={resource} className="border-b border-border hover:bg-surface-muted/50 transition-colors">
                <td className="sticky left-0 bg-surface px-3 py-2">
                  <button
                    type="button"
                    className="text-left font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => toggleRow(resource)}
                  >
                    {resourceLabels[resource]}
                  </button>
                </td>
                {permissionActions.map((action) => {
                  const checked = cur.includes(action);
                  return (
                    <td key={action} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        className={cn(
                          "inline-flex size-7 items-center justify-center rounded transition-colors",
                          checked
                            ? "bg-primary text-primary-foreground hover:bg-primary/80"
                            : "bg-surface-muted text-muted-foreground hover:bg-surface-muted/70"
                        )}
                        onClick={() => toggleCell(resource, action)}
                        aria-label={`${checked ? "Remove" : "Grant"} ${actionLabels[action]} on ${resourceLabels[resource]}`}
                      >
                        {checked ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                  {cur.length}/{permissionActions.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssignRoleDrawer({
  dashboard,
  open,
  onClose,
  preselectedRoleId,
}: {
  dashboard: OrganizationOwnerDashboard;
  open: boolean;
  onClose: () => void;
  preselectedRoleId: string | undefined;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignedRoles, setAssignedRoles] = useState<CustomRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);

  const staff = useMemo(
    () =>
      (dashboard.branchUsers as Array<{
        user_id: string;
        profiles?: { full_name?: string; email?: string; role_name?: string } | null;
        role_name: string;
      }>)
        .filter((bu, i, arr) => arr.findIndex((x) => x.user_id === bu.user_id) === i)
        .map((bu) => ({
          userId: bu.user_id,
          name: bu.profiles?.full_name ?? bu.profiles?.email ?? bu.user_id.slice(0, 8),
          builtInRole: bu.role_name,
        })),
    [dashboard.branchUsers]
  );

  useEffect(() => {
    if (!open) return;
    import("@/features/organization-owner/actions/custom-roles-actions").then((m) => {
      m.getCustomRoles(dashboard.organization.id).then(setAvailableRoles);
    });
  }, [open, dashboard.organization.id]);

  useEffect(() => {
    if (!selectedUserId || !open) {
      setAssignedRoles([]);
      return;
    }
    import("@/features/organization-owner/actions/custom-roles-actions").then(async (m) => {
      const cr = await m.getUserCustomRoles(dashboard.organization.id, selectedUserId);
      setAssignedRoles(cr);
    });
  }, [selectedUserId, open, dashboard.organization.id]);

  const selectedStaffMember = staff.find((s) => s.userId === selectedUserId);

  const handleAssign = useCallback(
    async (roleId: string) => {
      if (!selectedUserId) return;
      setLoading(true);
      const fd = new FormData();
      fd.set("userId", selectedUserId);
      fd.set("customRoleId", roleId);
      const result = await assignCustomRoleToUserAction({ status: "idle", message: "" }, fd);
      showToast(result.message || "Done", result.status === "success" ? "success" : "error");
      if (result.status === "success") {
        const { getUserCustomRoles } = await import("@/features/organization-owner/actions/custom-roles-actions");
        const cr = await getUserCustomRoles(dashboard.organization.id, selectedUserId);
        setAssignedRoles(cr);
      }
      setLoading(false);
    },
    [selectedUserId, dashboard.organization.id]
  );

  const handleRemove = useCallback(
    async (roleId: string) => {
      if (!selectedUserId) return;
      setLoading(true);
      const fd = new FormData();
      fd.set("userId", selectedUserId);
      fd.set("customRoleId", roleId);
      const result = await removeCustomRoleFromUserAction({ status: "idle", message: "" }, fd);
      showToast(result.message || "Done", result.status === "success" ? "success" : "error");
      if (result.status === "success") {
        const { getUserCustomRoles } = await import("@/features/organization-owner/actions/custom-roles-actions");
        const cr = await getUserCustomRoles(dashboard.organization.id, selectedUserId);
        setAssignedRoles(cr);
      }
      setLoading(false);
    },
    [selectedUserId, dashboard.organization.id]
  );

  const unassignedRoles = availableRoles.filter((r) => !assignedRoles.some((a) => a.id === r.id));

  return (
    <OrgOwnerDrawer
      description="Assign custom roles to staff members in your organization"
      onClose={onClose}
      open={open}
      title="Assign Custom Roles to Staff"
      size="lg"
    >
      <div className="space-y-5">
        <DrawerField label="Staff Member">
          <select
            className={selectClass}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">Select a staff member</option>
            {staff.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.name} — {s.builtInRole}
              </option>
            ))}
          </select>
        </DrawerField>

        {selectedStaffMember ? (
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <p className="font-medium">{selectedStaffMember.name}</p>
            <p className="text-xs text-muted-foreground">Built-in Role: {selectedStaffMember.builtInRole}</p>
          </div>
        ) : null}

        {assignedRoles.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-bold">Currently Assigned Custom Roles</p>
            <div className="space-y-2">
              {assignedRoles.map((role) => (
                <div key={role.id} className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-3 py-2">
                  <div>
                    <p className="font-medium">{role.name}</p>
                    {role.description ? <p className="text-xs text-muted-foreground">{role.description}</p> : null}
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => handleRemove(role.id)} disabled={loading}>
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : selectedUserId ? (
          <p className="text-sm text-muted-foreground text-center py-2">No custom roles assigned yet.</p>
        ) : null}

        {selectedUserId && unassignedRoles.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-bold">Available Custom Roles</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {unassignedRoles.map((role) => (
                <div key={role.id} className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-3 py-2">
                  <div>
                    <p className="font-medium">{role.name}</p>
                    {role.description ? <p className="text-xs text-muted-foreground">{role.description}</p> : null}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => handleAssign(role.id)} disabled={loading}>
                    <UserPlus className="size-3.5" /> Assign
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </OrgOwnerDrawer>
  );
}

export function CustomRolesModule({ dashboard, moduleData, hasFeature }: CustomRolesModuleProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [preselectedRoleId, setPreselectedRoleId] = useState<string | undefined>(undefined);
  const [deleteState, deleteAction] = useActionState(deleteCustomRoleAction, initialAuthActionState);
  const [createState, createAction] = useActionState(createCustomRoleAction, initialAuthActionState);
  const [updateState, updateAction] = useActionState(updateCustomRoleAction, initialAuthActionState);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  const roles: CustomRole[] = (moduleData?.items as CustomRole[]) ?? [];

  useEffect(() => {
    if (!hasFeature || roles.length === 0) return;
    import("@/features/organization-owner/actions/custom-roles-actions").then((m) => {
      m.getCustomRoleUserCounts(dashboard.organization.id).then(setUserCounts).catch(() => {});
    });
  }, [hasFeature, roles.length, dashboard.organization.id]);

  const openCreate = useCallback(() => {
    setEditingRole(null);
    setPermissions({});
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((role: CustomRole) => {
    setEditingRole(role);
    setPermissions((role.permissions as Record<string, string[]>) ?? {});
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingRole(null);
    setPermissions({});
  }, []);

  const openAssignForRole = useCallback((roleId: string) => {
    setPreselectedRoleId(roleId);
    setAssignDrawerOpen(true);
  }, []);

  const closeAssign = useCallback(() => {
    setAssignDrawerOpen(false);
    setPreselectedRoleId(undefined);
  }, []);

  useEffect(() => {
    if (deleteState.status === "success") {
      showToast(deleteState.message || "Role deleted.", "success");
    } else if (deleteState.status === "error") {
      showToast(deleteState.message || "Failed to delete role.", "error");
    }
  }, [deleteState]);

  if (!hasFeature) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-surface-muted">
          <Lock className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-bold">Custom Roles & Granular Permissions</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Custom roles require an Enterprise plan upgrade. Create role-based access with per-resource granular permissions.
        </p>
      </div>
    );
  }

  const items = roles.map((role) => {
    const permCount = Object.keys(role.permissions as Record<string, string[]> ?? {}).length;
    const assignedUsers = userCounts[role.id] ?? 0;
    return {
      id: role.id,
      title: role.name,
      subtitle: role.description ?? undefined,
      meta: `${assignedUsers} user${assignedUsers !== 1 ? "s" : ""} assigned · ${permCount} resources · Created ${new Date(role.created_at).toLocaleDateString("en-IN")}`,
      badge: "active",
      badgeVariant: "success" as const,
      avatar: <ShieldCheck className="size-5 text-primary" />,
      sections: [
        { label: "Name", value: role.name },
        { label: "Description", value: role.description ?? "—" },
        { label: "Users Assigned", value: String(assignedUsers) },
        { label: "Resources Permitted", value: String(permCount) },
      ],
      actions: [
        { label: "Edit", onClick: () => openEdit(role), variant: "secondary" as const, icon: <Pencil className="size-3.5" /> },
        { label: "Assign", onClick: () => openAssignForRole(role.id), variant: "secondary" as const, icon: <UserPlus className="size-3.5" /> },
        { label: "Delete", onClick: () => {
          if (!window.confirm(`Delete custom role "${role.name}"? This will also remove it from all assigned users.`)) return;
          const fd = new FormData();
          fd.set("roleId", role.id);
          deleteAction(fd);
        }, variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> },
      ],
    };
  });

  return (
    <div className="space-y-6">
      <DataList
        headerTitle="Custom Roles"
        headerAction={
          <Button onClick={openCreate} size="sm" variant="primary">
            <Plus className="size-4" /> Create Role
          </Button>
        }
        items={items}
        totalItems={roles.length}
        totalPages={Math.ceil(roles.length / 12)}
        currentPage={1}
      />

      {/* Create/Edit Drawer */}
      <OrgOwnerDrawer
        description={editingRole ? `Editing ${editingRole.name}` : "Define a new custom role with granular permissions"}
        onClose={closeDrawer}
        open={drawerOpen}
        title={editingRole ? "Edit Custom Role" : "Create Custom Role"}
        size="xl"
      >
        <form
          action={editingRole ? updateAction : createAction}
          className="space-y-5"
        >
          <DrawerFormMessage status={editingRole ? updateState.status : createState.status} message={editingRole ? updateState.message : createState.message} />
          {editingRole ? <input name="roleId" type="hidden" value={editingRole.id} /> : null}

          <DrawerField label="Role Name" required>
            <input
              className={selectClass}
              defaultValue={editingRole?.name ?? ""}
              name="name"
              placeholder="e.g. Branch Billing Manager"
              required
              type="text"
            />
          </DrawerField>

          <DrawerField label="Description">
            <textarea
              className={textareaClass}
              defaultValue={editingRole?.description ?? ""}
              name="description"
              placeholder="Brief description of this role"
            />
          </DrawerField>

          <div className="space-y-2">
            <p className="text-sm font-bold">Permissions Matrix</p>
            <p className="text-xs text-muted-foreground">
              Click cells to grant/deny permissions. Row headers toggle entire resources. Column headers toggle all resources for that action.
            </p>
            <PermissionGrid permissions={permissions} onChange={setPermissions} />
            <input name="permissions" type="hidden" value={JSON.stringify(permissions)} />
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button
              className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong"
              onClick={closeDrawer}
              type="button"
            >
              Cancel
            </button>
            <DrawerSubmitButton>{editingRole ? "Save Changes" : "Create Role"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* Assign Roles Drawer */}
      <AssignRoleDrawer
        dashboard={dashboard}
        open={assignDrawerOpen}
        onClose={closeAssign}
        preselectedRoleId={preselectedRoleId}
      />
    </div>
  );
}
