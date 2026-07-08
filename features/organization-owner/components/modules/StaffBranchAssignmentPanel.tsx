"use client";

import { useCallback, useEffect, useState, useActionState, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, Building2, ChevronDown } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import {
  getStaffBranchAssignments,
  assignStaffToBranch,
  removeStaffFromBranch,
  type BranchAssignment,
} from "@/features/organization-owner/actions/staff-branch-actions";

type StaffBranchAssignmentPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function StaffBranchAssignmentPanel({ dashboard, hasFeature }: StaffBranchAssignmentPanelProps) {
  const orgId = dashboard.organization.id;

  const staffList = (dashboard.branchUsers as Record<string, unknown>[])
    .filter((bu) => bu.status !== "revoked")
    .map((bu) => {
      const profile = bu.profiles as { full_name?: string; email?: string } | null;
      return {
        id: bu.user_id as string,
        name: profile?.full_name ?? profile?.email ?? "Unknown",
        email: profile?.email ?? null,
        roleName: bu.role_name as string,
      };
    })
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);

  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.id ?? "");
  const [assignments, setAssignments] = useState<BranchAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assignState, assignFormAction] = useActionState(assignStaffToBranch, initialAuthActionState);

  const loadAssignments = useCallback(async () => {
    if (!selectedStaffId) { setAssignments([]); return; }
    setLoading(true);
    try {
      const data = await getStaffBranchAssignments(orgId, selectedStaffId);
      setAssignments(data.filter((a) => a.status !== "revoked"));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load assignments.", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedStaffId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (assignState.status === "success") {
      setDrawerOpen(false);
      loadAssignments();
      showToast("Staff assigned to branch.", "success");
    } else if (assignState.status === "error" && assignState.message) {
      showToast(assignState.message, "error");
    }
  }, [assignState, loadAssignments]);

  const handleRemove = useCallback(async (assignment: BranchAssignment) => {
    const fd = new FormData();
    fd.set("assignmentId", assignment.id);
    fd.set("userId", assignment.user_id);
    const r = await removeStaffFromBranch(initialAuthActionState, fd);
    if (r.status !== "success") showToast(r.message || "Failed to remove.", "error");
    else {
      showToast("Staff removed from branch.", "success");
      loadAssignments();
    }
  }, [loadAssignments]);

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);
  const assignedBranchIds = new Set(assignments.map((a) => a.branch_id));
  const unassignedBranches = dashboard.branches.filter((b) => !assignedBranchIds.has(b.id));

  const conflicts = useMemo(() => {
    if (!selectedStaffId || assignments.length < 2) return [];
    const staffSessions = (dashboard.classSessions as Record<string, unknown>[])
      .filter((cs) =>
        (cs.primary_trainer_id === selectedStaffId || cs.substitute_trainer_id === selectedStaffId) &&
        (cs.status === "scheduled" || cs.status === "in_progress")
      );
    if (staffSessions.length < 2) return [];
    const results: Array<{ session1: Record<string, unknown>; session2: Record<string, unknown>; branch1Name: string; branch2Name: string }> = [];
    for (let i = 0; i < staffSessions.length; i++) {
      const a = staffSessions[i]!;
      for (let j = i + 1; j < staffSessions.length; j++) {
        const b = staffSessions[j]!;
        if (a.branch_id === b.branch_id) continue;
        const aStart = new Date(a.starts_at as string).getTime();
        const aEnd = new Date(a.ends_at as string).getTime();
        const bStart = new Date(b.starts_at as string).getTime();
        const bEnd = new Date(b.ends_at as string).getTime();
        if (aStart < bEnd && bStart < aEnd) {
          const branch1 = dashboard.branches.find((br) => br.id === (a.branch_id as string));
          const branch2 = dashboard.branches.find((br) => br.id === (b.branch_id as string));
          results.push({
            session1: a, session2: b,
            branch1Name: branch1?.name ?? "Unknown",
            branch2Name: branch2?.name ?? "Unknown",
          });
        }
      }
    }
    return results;
  }, [selectedStaffId, assignments, dashboard.classSessions, dashboard.branches]);

  if (!hasFeature) {
    return (
      <div className="rounded-md border border-border bg-surface p-8 text-center">
        <Building2 className="mx-auto size-10 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">Multi-branch staff assignment requires a Growth or Enterprise plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <label className="text-sm font-bold block mb-2">Select Staff Member</label>
          <select
            className={selectClass}
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            <option value="">Choose staff...</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({formatEnterpriseLabel(s.roleName)})</option>
            ))}
          </select>
        </div>
        {selectedStaffId ? (
          <Button onClick={() => setDrawerOpen(true)} variant="primary" size="sm" className="mt-auto">
            <Plus className="size-4" /> Add Branch
          </Button>
        ) : null}
      </div>

      {selectedStaffId && selectedStaff ? (
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <p className="text-sm font-bold text-foreground">{selectedStaff.name}</p>
          <p className="text-xs text-muted-foreground">{selectedStaff.email} · {formatEnterpriseLabel(selectedStaff.roleName)}</p>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Scheduling conflict detected</p>
            <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
              {conflicts.map((c, i) => (
                <li key={i}>
                  Overlap at {c.branch1Name} and {c.branch2Name} on{" "}
                  {new Date(c.session1.starts_at as string).toLocaleDateString("en-IN")}{" "}
                  ({new Date(c.session1.starts_at as string).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} —{" "}
                  {new Date(c.session1.ends_at as string).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-amber-600">This staff is scheduled at overlapping class times across different branches.</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading assignments...</p>
      ) : assignments.length === 0 && selectedStaffId ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center">
          <Building2 className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No branch assignments for this staff member.</p>
          <p className="text-xs text-muted-foreground mt-1">Click &quot;Add Branch&quot; to assign this staff to a branch.</p>
        </div>
      ) : (
        <DataList
          items={assignments.map((a) => ({
            id: a.id,
            title: a.branch_name ?? "Unknown Branch",
            subtitle: a.gym_name ?? undefined,
            meta: `${formatEnterpriseLabel(a.role_name)} · ${formatEnterpriseLabel(a.branch_role)} · ${a.access_scope === "multi_branch" ? "Multi-branch" : "Single branch"}`,
            badge: a.status,
            badgeVariant: (a.status === "active" ? "success" : "neutral") as "success" | "neutral",
            sections: [
              { label: "Role", value: formatEnterpriseLabel(a.role_name) },
              { label: "Gym Role", value: formatEnterpriseLabel(a.branch_role) },
              { label: "Access Scope", value: formatEnterpriseLabel(a.access_scope) },
              { label: "Assigned", value: new Date(a.created_at).toLocaleDateString("en-IN") },
            ],
            actions: [
              { label: "Remove", onClick: () => handleRemove(a), variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> },
            ],
          }))}
          totalItems={assignments.length}
          headerTitle="Gym Assignments"
        />
      )}

      {!selectedStaffId ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center">
          <ChevronDown className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Select a staff member above to view and manage their branch assignments.</p>
        </div>
      ) : null}

      <OrgOwnerDrawer
        description={`Assign ${selectedStaff?.name ?? "staff"} to an additional branch`}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        title="Add Branch Assignment"
        size="md"
      >
        <form action={assignFormAction} className="space-y-5">
          <DrawerFormMessage status={assignState.status} message={assignState.message} />
          <input name="userId" type="hidden" value={selectedStaffId} />

          <DrawerField label="Gym" required>
            <select className={selectClass} name="branchId" required>
              <option value="">Select branch</option>
              {unassignedBranches.map((branch) => {
                const gym = dashboard.gyms.find((g) => g.id === branch.gym_id);
                return <option key={branch.id} value={branch.id}>{branch.name} {gym ? `(${gym.name})` : ""}</option>;
              })}
            </select>
          </DrawerField>

          <DrawerField label="Role" required>
            <select className={selectClass} name="roleName" required>
              <option value="">Select role</option>
              <option value="gym_admin">Branch Manager</option>
              <option value="reception_staff">Reception Staff</option>
              <option value="trainer">Trainer</option>
            </select>
          </DrawerField>

          <DrawerField label="Access Scope">
            <select className={selectClass} defaultValue="single_branch" name="accessScope">
              <option value="single_branch">Single Branch</option>
              <option value="multi_branch">Multi Branch</option>
              <option value="organization">Organization</option>
            </select>
          </DrawerField>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={() => setDrawerOpen(false)} type="button">Cancel</button>
            <DrawerSubmitButton>Assign</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
