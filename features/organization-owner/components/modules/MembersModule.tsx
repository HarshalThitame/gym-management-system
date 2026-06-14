"use client";

import { useCallback, useState, useActionState } from "react";
import { Ban, CalendarDays, CreditCard, Download, Dumbbell, Edit3, Eye, Plus, UserRound, UsersRound, VenetianMask } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveMemberAction, transferMemberAction } from "@/features/organization-owner/actions/member-actions";
import { bulkSuspendMembersAction, bulkTransferMembersAction } from "@/features/organization-owner/actions/bulk-actions";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type MembersModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: Record<string, unknown>[] };
};

type MemberRow = Database["public"]["Tables"]["members"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500"];

function MemberAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  const colorIndex = name.length % colors.length;
  return <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colors[colorIndex]}`}>{initial}</div>;
}

export function MembersModule({ dashboard, moduleData }: MembersModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transferDrawerOpen, setTransferDrawerOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [transferringMember, setTransferringMember] = useState<MemberRow | null>(null);
  const [state, formAction] = useActionState(saveMemberAction, initialAuthActionState);
  const [transferState, transferFormAction] = useActionState(transferMemberAction, initialAuthActionState);

  const initialMembers = (moduleData?.items ?? dashboard.members) as MemberRow[];
  const { items: members, addOptimistic, updateOptimistic, removeOptimistic } = useOptimisticList<MemberRow>(initialMembers);

  // ── KPIs ──
  const activeCount = members.filter((m) => m.status === "active").length;
  const inactiveCount = members.filter((m) => m.status === "inactive").length;
  const archivedCount = members.filter((m) => m.status === "archived").length;
  const newThisMonth = members.filter((m) => {
    if (!m.joined_at) return false;
    const j = new Date(m.joined_at);
    const n = new Date();
    return j.getMonth() === n.getMonth() && j.getFullYear() === n.getFullYear();
  }).length;
  const withTrainer = members.filter((m) => m.assigned_trainer_id).length;

  // ── Computed ──
  const expiryCount = dashboard.memberships.filter((m) => {
    if (!m.end_date || m.status !== "active") return false;
    const e = new Date(m.end_date).getTime();
    const n = Date.now();
    return e > n && e < n + 30 * 86400000;
  }).length;

  const openCreate = useCallback(() => { setEditingMember(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((m: MemberRow) => { setEditingMember(m); setDrawerOpen(true); }, []);
  const openTransfer = useCallback((m: MemberRow) => { setTransferringMember(m); setTransferDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingMember(null); }, []);
  const closeTransfer = useCallback(() => { setTransferDrawerOpen(false); setTransferringMember(null); }, []);
  const handleApplyFilters = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, gymId: f.gymId }); }, [navigate]);

  // ── Member Detail Panel ──
  const detailGym = detailMember ? dashboard.gyms.find((g) => g.id === detailMember.gym_id) : null;
  const detailTrainer = detailMember?.assigned_trainer_id ? dashboard.trainers.find((t) => t.id === detailMember.assigned_trainer_id) : null;
  const detailMemberships = detailMember ? dashboard.memberships.filter((m) => m.member_id === detailMember.id) : [];
  const detailPayments = detailMember ? dashboard.payments.filter((p) => p.member_id === detailMember.id) : [];

  const items = members.map((member) => {
    const gym = dashboard.gyms.find((g) => g.id === member.gym_id);
    const trainer = member.assigned_trainer_id ? dashboard.trainers.find((t) => t.id === member.assigned_trainer_id) : null;
    const activeMembership = dashboard.memberships.find((m) => m.member_id === member.id && m.status === "active");
    const lastVisit = dashboard.attendanceLogs.filter((l) => l.member_id === member.id).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0];

    return {
      id: member.id,
      title: member.full_name,
      subtitle: `${member.member_code} · ${gym?.name ?? "Unknown gym"}`,
      meta: `${member.phone}${activeMembership ? ` · ${formatEnterpriseLabel(activeMembership.status)} membership` : ""}${lastVisit ? ` · Last visit: ${new Date(lastVisit.occurred_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}`,
      badge: member.status,
      badgeVariant: (member.status === "active" ? "success" : member.status === "inactive" ? "neutral" : "warning") as "success" | "neutral" | "warning",
      status: member.status,
      avatar: <MemberAvatar name={member.full_name} />,
      sections: [
        { label: "Phone", value: member.phone },
        { label: "Email", value: member.email ?? "—" },
        { label: "Gym", value: gym?.name ?? "—" },
        { label: "Trainer", value: trainer?.display_name ?? "None" },
        { label: "Joined", value: member.joined_at ? new Date(member.joined_at).toLocaleDateString("en-IN") : "—" },
        { label: "DOB", value: member.date_of_birth ?? "—" },
      ],
      actions: [
        { label: "Details", onClick: () => setDetailMember(member), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        { label: "Edit", onClick: () => openEdit(member), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
        { label: "Transfer", onClick: () => openTransfer(member), variant: "secondary" as const, icon: <UserRound className="size-3.5" /> },
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? dashboard.members.length;

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total members across all gyms" icon={<UsersRound className="size-5" />} label="Total Members" value={formatCompactNumber(members.length)} />
        <StatCard detail="Active members" icon={<UsersRound className="size-5" />} label="Active" value={formatCompactNumber(activeCount)} />
        <StatCard detail="Members who joined this month" icon={<CalendarDays className="size-5" />} label="New This Month" value={String(newThisMonth)} />
        <StatCard detail="Memberships expiring in 30 days" icon={<CreditCard className="size-5" />} label="Expiring Soon" value={String(expiryCount)} />
        <StatCard detail="Inactive members" icon={<UsersRound className="size-5" />} label="Inactive" value={formatCompactNumber(inactiveCount)} />
        <StatCard detail="Members with assigned trainer" icon={<Dumbbell className="size-5" />} label="With Trainer" value={formatCompactNumber(withTrainer)} />
        <StatCard detail="Archived member records" icon={<VenetianMask className="size-5" />} label="Archived" value={formatCompactNumber(archivedCount)} />
        <StatCard detail="Total active memberships" icon={<CreditCard className="size-5" />} label="Active Plans" value={formatCompactNumber(dashboard.memberships.filter((m) => m.status === "active").length)} />
      </section>

      {/* ═══ FILTERS ═══ */}
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "archived", label: "Archived" }
          ]},
          { key: "gymId", label: "Gym", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
        ]}
        searchPlaceholder="Search by name, phone, email, or member code..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as Record<string, string>}
      />

      {/* ═══ DATA LIST ═══ */}
      <DataList
        selectable
        bulkActions={[
          { label: "Suspend", onClick: async (ids) => { const fd = new FormData(); fd.set("memberIds", ids.join(",")); const r = await bulkSuspendMembersAction({ status: "idle" }, fd); showToast(r.message || "Done", r.status === "success" ? "success" : "error"); }, variant: "destructive" as const, icon: <Ban className="size-3.5" /> },
          { label: "Transfer", onClick: async (ids) => { const targetGymId = prompt("Target Gym ID:"); if (!targetGymId) return; const fd = new FormData(); fd.set("memberIds", ids.join(",")); fd.set("targetGymId", targetGymId); const r = await bulkTransferMembersAction({ status: "idle" }, fd); showToast(r.message || "Done", r.status === "success" ? "success" : "error"); }, variant: "secondary" as const, icon: <UsersRound className="size-3.5" /> },
          { label: "Export", onClick: (ids) => { const data = members.filter((m) => ids.includes(m.id)).map((m) => ({ name: m.full_name, code: m.member_code, phone: m.phone, email: m.email, status: m.status, gender: m.gender, joined: m.joined_at })); exportToCSV(data, "members-selected"); }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(members.map((m) => ({ name: m.full_name, code: m.member_code, phone: m.phone, email: m.email, status: m.status, gym_id: m.gym_id, trainer_id: m.assigned_trainer_id, joined: m.joined_at })), "all-members")}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Member</Button>}
        headerTitle="Members" items={items}
        totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description={editingMember ? `Editing ${editingMember.full_name}` : "Register a new member"} onClose={closeDrawer} open={drawerOpen} title={editingMember ? "Edit Member" : "Add Member"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingMember ? <input name="memberId" type="hidden" value={editingMember.id} /> : null}
          {editingMember ? <MemberAvatar name={editingMember.full_name} /> : null}
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
            <DrawerField label="Date of Birth">
              <input className={selectClass} defaultValue={editingMember?.date_of_birth ?? ""} name="dateOfBirth" type="date" />
            </DrawerField>
            <DrawerField label="Gender">
              <select className={selectClass} defaultValue={editingMember?.gender ?? ""} name="gender">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </DrawerField>
            <DrawerField label="Emergency Contact Name">
              <input className={selectClass} defaultValue={editingMember?.emergency_contact_name ?? ""} name="emergencyContactName" type="text" />
            </DrawerField>
            <DrawerField label="Emergency Contact Phone">
              <input className={selectClass} defaultValue={editingMember?.emergency_contact_phone ?? ""} name="emergencyContactPhone" type="text" />
            </DrawerField>
            <DrawerField label="Trainer">
              <select className={selectClass} defaultValue={editingMember?.assigned_trainer_id ?? ""} name="assignedTrainerId">
                <option value="">None</option>
                {dashboard.trainers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Address">
              <input className={selectClass} defaultValue={editingMember?.address ?? ""} name="address" type="text" />
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingMember ? "Update" : "Add Member"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ TRANSFER DRAWER ═══ */}
      <OrgOwnerDrawer description={`Transfer ${transferringMember?.full_name ?? ""} to another gym`} onClose={closeTransfer} open={transferDrawerOpen} title="Transfer Member" size="md">
        <form action={transferFormAction} className="space-y-5">
          <DrawerFormMessage status={transferState.status} message={transferState.message} />
          {transferringMember ? <input name="memberId" type="hidden" value={transferringMember.id} /> : null}
          {transferringMember ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
              <MemberAvatar name={transferringMember.full_name} />
              <div>
                <p className="text-sm font-bold">{transferringMember.full_name}</p>
                <p className="text-xs text-muted-foreground">{transferringMember.member_code} · Current: {dashboard.gyms.find((g) => g.id === transferringMember.gym_id)?.name ?? "Unknown"}</p>
              </div>
            </div>
          ) : null}
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

      {/* ═══ DETAIL PANEL ═══ */}
      {detailMember ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={() => setDetailMember(null)}>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${detailMember.full_name} details`}>
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <MemberAvatar name={detailMember.full_name} />
                <div className="min-w-0">
                  <h2 className="text-xl font-black truncate">{detailMember.full_name}</h2>
                  <p className="text-sm text-muted-foreground">{detailMember.member_code} · <EnterpriseStatusBadge status={detailMember.status} /></p>
                </div>
              </div>
              <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => setDetailMember(null)} type="button" aria-label="Close"><UserRound className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Contact */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Contact</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-bold">{detailMember.phone}</p></div>
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-bold">{detailMember.email ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Date of Birth</p><p className="text-sm font-bold">{detailMember.date_of_birth ? new Date(detailMember.date_of_birth).toLocaleDateString("en-IN") : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Gender</p><p className="text-sm font-bold capitalize">{detailMember.gender?.replace(/_/g, " ") ?? "—"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-bold">{detailMember.address ?? "—"}</p></div>
                </CardContent>
              </Card>

              {/* Gym & Trainer */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Assignment</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Gym</p><p className="text-sm font-bold">{detailGym?.name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Trainer</p><p className="text-sm font-bold">{detailTrainer?.display_name ?? "None assigned"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Joined</p><p className="text-sm font-bold">{detailMember.joined_at ? new Date(detailMember.joined_at).toLocaleDateString("en-IN") : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={detailMember.status} /></div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Emergency Contact</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Name</p><p className="text-sm font-bold">{detailMember.emergency_contact_name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-bold">{detailMember.emergency_contact_phone ?? "—"}</p></div>
                </CardContent>
              </Card>

              {/* Memberships */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Memberships ({detailMemberships.length})</h3></CardHeader>
                <CardContent className="space-y-3">
                  {detailMemberships.length === 0 ? <p className="text-sm text-muted-foreground">No membership history</p> : detailMemberships.slice(0, 5).map((ms) => {
                    const plan = dashboard.membershipPlans.find((p) => p.id === (ms as unknown as { membership_plan_id: string }).membership_plan_id);
                    return (
                      <div key={ms.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                        <div><p className="text-sm font-bold">{plan?.name ?? "Unknown plan"}</p><p className="text-xs text-muted-foreground">{ms.start_date ? new Date(ms.start_date).toLocaleDateString("en-IN") : "—"} → {ms.end_date ? new Date(ms.end_date).toLocaleDateString("en-IN") : "—"}</p></div>
                        <EnterpriseStatusBadge status={ms.status} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Payments */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Payments ({detailPayments.length})</h3></CardHeader>
                <CardContent className="space-y-3">
                  {detailPayments.length === 0 ? <p className="text-sm text-muted-foreground">No payment history</p> : detailPayments.slice(0, 5).map((pm) => (
                    <div key={pm.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                      <div><p className="text-sm font-bold">{pm.payment_number}</p><p className="text-xs text-muted-foreground">{new Date(pm.created_at).toLocaleDateString("en-IN")} · {pm.payment_type}</p></div>
                      <div className="text-right"><p className="text-sm font-black">{formatCurrency(Number(pm.amount ?? 0), pm.currency)}</p><EnterpriseStatusBadge status={pm.status} /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
