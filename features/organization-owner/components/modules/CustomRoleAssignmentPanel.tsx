"use client";

import { useCallback, useState, useEffect } from "react";
import { Lock, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import type { CustomRole } from "@/features/organization-owner/actions/custom-roles-actions";
import { cn } from "@/lib/utils";

type CustomRoleAssignmentPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

export function CustomRoleAssignmentPanel({ dashboard, hasFeature }: CustomRoleAssignmentPanelProps) {
  const [staff, setStaff] = useState<Array<{
    userId: string;
    name: string;
    email: string | null;
    builtInRole: string;
  }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [assignedRoleIds, setAssignedRoleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasFeature) return;
    const uniqueUsers = new Map<string, { userId: string; name: string; email: string | null; builtInRole: string }>();
    for (const bu of (dashboard.branchUsers as Array<{
      user_id: string;
      profiles?: { full_name?: string; email?: string } | null;
      role_name: string;
    }>)) {
      if (!uniqueUsers.has(bu.user_id)) {
        uniqueUsers.set(bu.user_id, {
          userId: bu.user_id,
          name: bu.profiles?.full_name ?? bu.profiles?.email ?? bu.user_id.slice(0, 8),
          email: bu.profiles?.email ?? null,
          builtInRole: bu.role_name,
        });
      }
    }
    setStaff(Array.from(uniqueUsers.values()));
  }, [dashboard.branchUsers, hasFeature]);

  useEffect(() => {
    if (!hasFeature || !selectedUserId) {
      setAssignedRoleIds(new Set());
      return;
    }
    import("@/features/organization-owner/actions/custom-roles-actions").then(async (m) => {
      const roles = await m.getUserCustomRoles(dashboard.organization.id, selectedUserId);
      setAssignedRoleIds(new Set(roles.map((r) => r.id)));
    });
  }, [selectedUserId, dashboard.organization.id, hasFeature]);

  useEffect(() => {
    if (!hasFeature) return;
    import("@/features/organization-owner/actions/custom-roles-actions").then(async (m) => {
      const roles = await m.getCustomRoles(dashboard.organization.id);
      setCustomRoles(roles);
    });
  }, [dashboard.organization.id, hasFeature]);

  const handleAssign = useCallback(
    async (roleId: string) => {
      if (!selectedUserId) return;
      setLoading(true);
      const fd = new FormData();
      fd.set("userId", selectedUserId);
      fd.set("customRoleId", roleId);
      const { assignCustomRoleToUserAction } = await import("@/features/organization-owner/actions/custom-roles-actions");
      const result = await assignCustomRoleToUserAction({ status: "idle", message: "" }, fd);
      showToast(result.message || "Done", result.status === "success" ? "success" : "error");
      if (result.status === "success") {
        setAssignedRoleIds((prev) => new Set([...prev, roleId]));
      }
      setLoading(false);
    },
    [selectedUserId]
  );

  const handleRemove = useCallback(
    async (roleId: string) => {
      if (!selectedUserId) return;
      setLoading(true);
      const fd = new FormData();
      fd.set("userId", selectedUserId);
      fd.set("customRoleId", roleId);
      const { removeCustomRoleFromUserAction } = await import("@/features/organization-owner/actions/custom-roles-actions");
      const result = await removeCustomRoleFromUserAction({ status: "idle", message: "" }, fd);
      showToast(result.message || "Done", result.status === "success" ? "success" : "error");
      if (result.status === "success") {
        setAssignedRoleIds((prev) => {
          const next = new Set(prev);
          next.delete(roleId);
          return next;
        });
      }
      setLoading(false);
    },
    [selectedUserId]
  );

  const selectedStaff = staff.find((s) => s.userId === selectedUserId);

  if (!hasFeature) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-muted">
          <Lock className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-3 font-bold">Custom Role Assignment</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Custom role assignment requires an Enterprise plan upgrade.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h3 className="text-lg font-bold">Custom Role Assignment</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Assign custom roles with granular permissions to staff members.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold">Select Staff Member</label>
          <select
            className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">Select a staff member</option>
            {staff.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.name} ({s.builtInRole})
              </option>
            ))}
          </select>
        </div>

        {selectedStaff ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-surface-muted p-3">
              <p className="font-medium">{selectedStaff.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedStaff.email ?? "No email"} · Built-in Role: {selectedStaff.builtInRole}
              </p>
            </div>

            {customRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No custom roles defined yet. Create one in the Custom Roles module.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-bold">Available Custom Roles</p>
                {customRoles.map((role) => {
                  const isAssigned = assignedRoleIds.has(role.id);
                  return (
                    <div
                      key={role.id}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 transition-colors",
                        isAssigned
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-surface-muted"
                      )}
                    >
                      <div>
                        <p className="font-medium">{role.name}</p>
                        {role.description ? (
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        ) : null}
                      </div>
                      {isAssigned ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={loading}
                          onClick={() => handleRemove(role.id)}
                        >
                          <Trash2 className="size-3.5" /> Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={loading}
                          onClick={() => handleAssign(role.id)}
                        >
                          <UserPlus className="size-3.5" /> Assign
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
