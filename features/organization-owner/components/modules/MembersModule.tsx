"use client";

import { useCallback, useState, useActionState } from "react";
import { Ban, Edit3, Plus, UserRound, UsersRound } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList, type BulkAction } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveMemberAction, transferMemberAction } from "@/features/organization-owner/actions/member-actions";
import { bulkSuspendMembersAction, bulkTransferMembersAction } from "@/features/organization-owner/actions/bulk-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import type { Database } from "@/types/database";

type MembersModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: Record<string, unknown>[] };
  moduleFilters?: Record<string, unknown>;
};
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function MembersModule({ dashboard, moduleData }: MembersModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transferDrawerOpen, setTransferDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [transferringMember, setTransferringMember] = useState<MemberRow | null>(null);
  const [state, formAction] = useActionState(saveMemberAction, initialAuthActionState);
  const [transferState, transferFormAction] = useActionState(transferMemberAction, initialAuthActionState);

  const initialMembers = (moduleData?.items ?? dashboard.members) as MemberRow[];
  const { items: members, addOptimistic, updateOptimistic, removeOptimistic } = useOptimisticList<MemberRow>(initialMembers);

  const openCreate = useCallback(() => { setEditingMember(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((m: MemberRow) => { setEditingMember(m); setDrawerOpen(true); }, []);
  const openTransfer = useCallback((m: MemberRow) => { setTransferringMember(m); setTransferDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingMember(null); }, []);
  const closeTransfer = useCallback(() => { setTransferDrawerOpen(false); setTransferringMember(null); }, []);
  const handleApplyFilters = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, gymId: f.gymId }); }, [navigate]);

  const items = members.map((member) => ({
    id: member.id,
    title: member.full_name,
    subtitle: member.member_code,
    meta: `${member.phone} · ${member.email ?? "No email"} · ${member.joined_at ? new Date(member.joined_at).toLocaleDateString("en-IN") : "N/A"}`,
    badge: member.status,
    badgeVariant: (member.status === "active" ? "success" : member.status === "inactive" ? "neutral" : "warning") as "success" | "neutral" | "warning",
    status: member.status,
    sections: [
      { label: "Phone", value: member.phone },
      { label: "Email", value: member.email ?? "—" },
      { label: "Trainer", value: member.assigned_trainer_id ? "Assigned" : "None" },
      { label: "Joined", value: member.joined_at ? new Date(member.joined_at).toLocaleDateString("en-IN") : "—" }
    ],
    actions: [
      { label: "Edit", onClick: () => openEdit(member), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
      { label: "Transfer", onClick: () => openTransfer(member), variant: "secondary" as const, icon: <UserRound className="size-3.5" /> }
    ]
  }));

  const totalItems = moduleData?.items?.length ?? dashboard.members.length;

  return (
    <div className="space-y-6">
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "archived", label: "Archived" }
          ]},
          { key: "gymId", label: "Gym", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
        ]}
        searchPlaceholder="Search by name, phone, or email..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as unknown as Record<string, string>}
      />

      <DataList
        selectable
        bulkActions={[
          { label: "Suspend", onClick: async (ids) => { const fd = new FormData(); fd.set("memberIds", ids.join(",")); const r = await bulkSuspendMembersAction({ status: "idle" }, fd); showToast(r.message || "Done", r.status === "success" ? "success" : "error"); }, variant: "destructive" as const, icon: <Ban className="size-3.5" /> },
          { label: "Transfer", onClick: async (ids) => { const targetGymId = prompt("Target Gym ID:"); if (!targetGymId) return; const fd = new FormData(); fd.set("memberIds", ids.join(",")); fd.set("targetGymId", targetGymId); const r = await bulkTransferMembersAction({ status: "idle" }, fd); showToast(r.message || "Done", r.status === "success" ? "success" : "error"); }, variant: "secondary" as const, icon: <UsersRound className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(items.map((i) => ({ id: i.id, name: i.title, status: i.status })), "members-export")}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Member</Button>}
        headerTitle="Members" items={items}
        totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      <OrgOwnerDrawer description={editingMember ? `Editing ${editingMember.full_name}` : "Register a new member"} onClose={closeDrawer} open={drawerOpen} title={editingMember ? "Edit Member" : "Add Member"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingMember ? <input name="memberId" type="hidden" value={editingMember.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required>
              <select className={selectClass} defaultValue={editingMember?.gym_id ?? ""} name="gymId" required>
                <option value="">Select gym</option>
                {dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Full Name" required>
              <input className={selectClass} defaultValue={editingMember?.full_name ?? ""} name="fullName" required type="text" />
            </DrawerField>
            <DrawerField label="Phone" required>
              <input className={selectClass} defaultValue={editingMember?.phone ?? ""} name="phone" required type="text" />
            </DrawerField>
            <DrawerField label="Email">
              <input className={selectClass} defaultValue={editingMember?.email ?? ""} name="email" type="email" />
            </DrawerField>
            <DrawerField label="Trainer">
              <select className={selectClass} defaultValue={editingMember?.assigned_trainer_id ?? ""} name="assignedTrainerId">
                <option value="">None</option>
                {dashboard.trainers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
              </select>
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingMember ? "Update" : "Add Member"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      <OrgOwnerDrawer description={`Transfer ${transferringMember?.full_name ?? ""} to another gym`} onClose={closeTransfer} open={transferDrawerOpen} title="Transfer Member" size="md">
        <form action={transferFormAction} className="space-y-5">
          <DrawerFormMessage status={transferState.status} message={transferState.message} />
          {transferringMember ? <input name="memberId" type="hidden" value={transferringMember.id} /> : null}
          <DrawerField label="Target Gym" required>
            <select className={selectClass} defaultValue="" name="targetGymId" required>
              <option value="">Select target gym</option>
              {dashboard.gyms.filter((g) => g.id !== transferringMember?.gym_id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </DrawerField>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeTransfer} type="button">Cancel</button>
            <DrawerSubmitButton>Transfer Member</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
