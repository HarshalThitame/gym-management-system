"use client";

import { useCallback, useState, useActionState, useMemo, type ReactNode } from "react";
import {
  Banknote, Download, Dumbbell, Edit3, Eye, FileText, Percent, Plus, UserRound,
  UsersRound, GitBranch, Phone, Mail, Clock, Award, MapPin, X,
  CalendarDays, BarChart3, ShieldAlert, CheckCircle2, UserPlus, Briefcase,
  ChevronRight, Search, AlertTriangle,
} from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveTrainerAction, assignMemberToTrainerAction } from "@/features/organization-owner/actions/trainer-actions";
import { useHasFeature } from "@/features/organization-owner/entitlements";
import { Button } from "@/components/ui/button";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { TrainerCommissionPanel } from "./TrainerCommissionPanel";
import { CommissionRatesPanel } from "./CommissionRatesPanel";
import { PayrollModule } from "./PayrollModule";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; planContext?: OrgPlanContext | null | undefined };
type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-teal-500"];

function TrainerAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-9 text-sm";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dims} ${colors[name.length % colors.length]}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
      type="button"
    >
      {icon} {label}
    </button>
  );
}

function MemberAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
      {name.charAt(0)}
    </div>
  );
}

type StatKey = "all" | "active" | "on_leave" | "full_time" | "assigned_members" | "utilization" | null;

export function TrainersEnterpriseModule({ dashboard, moduleData, planContext }: Props) {
  const [activeTab, setActiveTab] = useState<"trainers" | "commissions" | "rates" | "payroll">("trainers");
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [detailTrainer, setDetailTrainer] = useState<TrainerRow | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<TrainerRow | null>(null);
  const [assigningTrainer, setAssigningTrainer] = useState<TrainerRow | null>(null);
  const [state, formAction] = useActionState(saveTrainerAction, initialAuthActionState);
  const [assignState, assignFormAction] = useActionState(assignMemberToTrainerAction, initialAuthActionState);
  const [additionalGymIds, setAdditionalGymIds] = useState<string[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [statPanel, setStatPanel] = useState<StatKey>(null);
  const hasTrainerSharing = useHasFeature("trainer_sharing_across_branches");

  const initial = (moduleData?.items ?? dashboard.trainers) as TrainerRow[];
  const { items: trainers, addOptimistic, updateOptimistic } = useOptimisticList<TrainerRow>(initial);

  const activeTrainers = useMemo(() => trainers.filter((t) => t.status === "active"), [trainers]);
  const onLeaveTrainers = useMemo(() => trainers.filter((t) => t.status === "on_leave"), [trainers]);
  const fullTimeTrainers = useMemo(() => trainers.filter((t) => t.employment_type === "full_time"), [trainers]);
  const totalAssignedMembers = useMemo(() => dashboard.members.filter((m) => m.assigned_trainer_id).length, [dashboard.members]);

  // ── Assigned members grouped by trainer ──
  const trainerMemberMap = useMemo(() => {
    const map = new Map<string, MemberRow[]>();
    for (const m of dashboard.members) {
      if (m.assigned_trainer_id) {
        const list = map.get(m.assigned_trainer_id) ?? [];
        list.push(m);
        map.set(m.assigned_trainer_id, list);
      }
    }
    return map;
  }, [dashboard.members]);

  // ── Trainer utilization from sessions ──
  const trainerSessionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of dashboard.classSessions) {
      if (s.primary_trainer_id) {
        counts.set(s.primary_trainer_id, (counts.get(s.primary_trainer_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [dashboard.classSessions]);

  const openCreate = useCallback(() => { setEditingTrainer(null); setAdditionalGymIds([]); setDrawerOpen(true); }, []);
  const openEdit = useCallback((t: TrainerRow) => { setEditingTrainer(t); setAdditionalGymIds([]); setDrawerOpen(true); }, []);
  const openAssign = useCallback((t: TrainerRow) => { setAssigningTrainer(t); setSelectedMemberId(""); setAssignDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingTrainer(null); }, []);
  const closeAssign = useCallback(() => { setAssignDrawerOpen(false); setAssigningTrainer(null); }, []);
  const handleApplyFilters = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, gymId: f.gymId }); }, [navigate]);

  const items = trainers.map((t) => {
    const gym = dashboard.gyms.find((g) => g.id === t.gym_id);
    const assignedMembers = dashboard.members.filter((m) => m.assigned_trainer_id === t.id);
    const activeMembers = assignedMembers.filter((m) => m.status === "active").length;
    const ptRevenue = dashboard.payments
      .filter((p) => p.status === "paid" && assignedMembers.some((m) => m.id === p.member_id))
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    return {
      id: t.id,
      title: t.display_name,
      subtitle: `${gym?.name ?? "Unknown"} · ${t.employee_code ?? "—"}`,
      meta: `${formatEnterpriseLabel(t.employment_type)} · ${t.years_experience ?? 0}yrs · Joined ${t.joined_at ? new Date(t.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}`,
      badge: t.status,
      badgeVariant: (t.status === "active" ? "success" : t.status === "on_leave" ? "warning" : "neutral") as "success" | "warning" | "neutral",
      status: t.status,
      avatar: <TrainerAvatar name={t.display_name} />,
      sections: [
        { label: "Type", value: formatEnterpriseLabel(t.employment_type) },
        { label: "Members", value: `${activeMembers} active · ${assignedMembers.length} total` },
        { label: "PT Revenue", value: formatCurrency(ptRevenue) },
        { label: "Experience", value: `${t.years_experience ?? 0} years` },
        ...(hasTrainerSharing ? [{ label: "Gym", value: gym?.name ?? "—" }] : []),
      ],
      actions: [
        { label: "Details", onClick: () => setDetailTrainer(t), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        { label: "Edit", onClick: () => openEdit(t), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
        { label: "Assign", onClick: () => openAssign(t), variant: "secondary" as const, icon: <UserRound className="size-3.5" /> },
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? dashboard.trainers.length;
  const orgId = dashboard.organization.id;
  const showCommissions = planContext?.features.trainerCommissionsPayroll === true;
  const showPayroll = planContext?.features.payrollExport === true;

  const tabs = useMemo(() => {
    const t: Array<{ key: typeof activeTab; label: string; icon: ReactNode }> = [
      { key: "trainers", label: "Trainers", icon: <Dumbbell className="size-4" /> },
    ];
    if (showCommissions) {
      t.push({ key: "commissions", label: "Commissions", icon: <Banknote className="size-4" /> });
      t.push({ key: "rates", label: "Rates", icon: <Percent className="size-4" /> });
    }
    if (showPayroll) {
      t.push({ key: "payroll", label: "Payroll", icon: <FileText className="size-4" /> });
    }
    return t;
  }, [showCommissions, showPayroll]);

  const trainerList = useMemo(() => trainers.map((t) => ({ id: t.id, display_name: t.display_name, gym_id: t.gym_id })), [trainers]);

  return (
    <div className="space-y-6">
      {tabs.length > 1 && (
        <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <TabButton key={tab.key} active={activeTab === tab.key} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.key)} />
          ))}
        </div>
      )}

      {activeTab !== "trainers" ? null : (
        <>
          {/* ═══ CLICKABLE KPI GRID ═══ */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setStatPanel("all")} className="text-left transition-all hover:opacity-80">
              <StatCard detail="View all trainer profiles across your gyms" icon={<Dumbbell className="size-5" />} label="Total Trainers" value={String(trainers.length)} />
            </button>
            <button type="button" onClick={() => setStatPanel("active")} className="text-left transition-all hover:opacity-80">
              <StatCard detail="Trainers currently active and available for sessions" icon={<CheckCircle2 className="size-5" />} label="Active" value={String(activeTrainers.length)} />
            </button>
            <button type="button" onClick={() => setStatPanel("on_leave")} className="text-left transition-all hover:opacity-80">
              <StatCard detail="Trainers currently on leave or unavailable" icon={<CalendarDays className="size-5" />} label="On Leave" value={String(onLeaveTrainers.length)} />
            </button>
            <button type="button" onClick={() => setStatPanel("full_time")} className="text-left transition-all hover:opacity-80">
              <StatCard detail="Full-time employed trainers" icon={<Award className="size-5" />} label="Full Time" value={String(fullTimeTrainers.length)} />
            </button>
            <button type="button" onClick={() => setStatPanel("assigned_members")} className="text-left transition-all hover:opacity-80">
              <StatCard detail="Members assigned to a personal trainer" icon={<UsersRound className="size-5" />} label="Assigned Members" value={formatCompactNumber(totalAssignedMembers)} />
            </button>
            <button type="button" onClick={() => setStatPanel("utilization")} className="text-left transition-all hover:opacity-80">
              <StatCard detail="Average trainer utilization across all gyms" icon={<BarChart3 className="size-5" />} label="Utilization" value={`${dashboard.metrics.avgTrainerUtilization}%`} />
            </button>
          </section>

          <FilterBar
            filterGroups={[
              { key: "status", label: "Status", options: [
                { value: "active", label: "Active" }, { value: "on_leave", label: "On Leave" }, { value: "inactive", label: "Inactive" }
              ]},
              { key: "gymId", label: "Gym", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
            ]}
            searchPlaceholder="Search by name, code, email, or phone..."
            onApply={handleApplyFilters}
            activeFilters={filters as unknown as Record<string, string>}
          />

          <DataList
            selectable
            bulkActions={[
              { label: "Export CSV", onClick: (ids) => {
                const data = trainers.filter((t) => ids.includes(t.id)).map((t) => ({
                  name: t.display_name, code: t.employee_code, type: t.employment_type,
                  experience: t.years_experience, status: t.status, email: t.email, phone: t.phone, joined: t.joined_at
                }));
                exportToCSV(data, "trainers-selected");
              }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
            ]}
            onExportCSV={() => exportToCSV(trainers.map((t) => ({
              name: t.display_name, code: t.employee_code, type: t.employment_type,
              experience: t.years_experience, status: t.status, email: t.email, phone: t.phone, joined: t.joined_at
            })), "all-trainers")}
            headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Trainer</Button>}
            headerTitle="Trainers"
            items={items}
            emptyTitle="No trainers yet"
            emptyDescription="Add your first trainer to start managing class sessions and personal training assignments."
            emptyAction={{ label: "Add Trainer", onClick: openCreate }}
            totalItems={totalItems}
            totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
            currentPage={currentPage}
            onPageChange={(p) => navigate({ page: p })}
            pageSize={filters.pageSize ?? 12}
          />
        </>
      )}

      {activeTab === "commissions" ? <TrainerCommissionPanel organizationId={orgId} trainers={trainerList} /> : null}
      {activeTab === "rates" ? <CommissionRatesPanel organizationId={orgId} trainers={trainerList} /> : null}
      {activeTab === "payroll" ? <PayrollModule organizationId={orgId} /> : null}

      {/* ═══ STAT DETAIL PANEL ═══ */}
      <StatDetailPanel
        statKey={statPanel}
        trainers={trainers}
        activeTrainers={activeTrainers}
        onLeaveTrainers={onLeaveTrainers}
        fullTimeTrainers={fullTimeTrainers}
        dashboard={dashboard}
        trainerMemberMap={trainerMemberMap}
        trainerSessionCounts={trainerSessionCounts}
        onClose={() => setStatPanel(null)}
        onEdit={openEdit}
        onAssign={openAssign}
        onViewDetail={(t) => { setStatPanel(null); setDetailTrainer(t); }}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer
        description={editingTrainer ? `Edit details for ${editingTrainer.display_name}` : "Add a new fitness trainer"}
        onClose={closeDrawer} open={drawerOpen}
        title={editingTrainer ? "Edit Trainer" : "Add Trainer"} size="lg"
      >
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingTrainer ? <input name="trainerId" type="hidden" value={editingTrainer.id} /> : null}
          <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-muted p-4">
            <TrainerAvatar name={editingTrainer?.display_name ?? "New"} size="lg" />
            <div>
              <p className="text-lg font-black">{editingTrainer ? editingTrainer.display_name : "New Trainer"}</p>
              <p className="text-sm text-muted-foreground">{editingTrainer ? `Code: ${editingTrainer.employee_code}` : "Auto-generated employee code"}</p>
            </div>
          </div>
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-muted-foreground">
              <UserRound className="size-3.5" /> Basic Information
            </h4>
            <div className="grid gap-5 md:grid-cols-2">
              <DrawerField label="Gym" required>
                <select className={selectClass} defaultValue={editingTrainer?.gym_id ?? ""} name="gymId" required>
                  <option value="">Select gym</option>
                  {dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </DrawerField>
              <DrawerField label="Full Name" required>
                <input className={selectClass} defaultValue={editingTrainer?.display_name ?? ""} name="displayName" required type="text" placeholder="e.g. John Smith" />
              </DrawerField>
              <DrawerField label="Email">
                <input className={selectClass} defaultValue={editingTrainer?.email ?? ""} name="email" type="email" placeholder="trainer@gym.com" />
              </DrawerField>
              <DrawerField label="Phone">
                <input className={selectClass} defaultValue={editingTrainer?.phone ?? ""} name="phone" type="text" placeholder="+91 98765 43210" />
              </DrawerField>
            </div>
          </div>
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-muted-foreground">
              <Briefcase className="size-3.5" /> Employment Information
            </h4>
            <div className="grid gap-5 md:grid-cols-3">
              <DrawerField label="Employment Type">
                <select className={selectClass} defaultValue={editingTrainer?.employment_type ?? "full_time"} name="employmentType">
                  <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                  <option value="contract">Contract</option><option value="consultant">Consultant</option>
                </select>
              </DrawerField>
              <DrawerField label="Experience (years)">
                <input className={selectClass} defaultValue={editingTrainer?.years_experience ?? 0} min={0} name="yearsExperience" type="number" />
              </DrawerField>
              <DrawerField label="Hourly Rate (₹)">
                <input className={selectClass} defaultValue={editingTrainer?.hourly_rate_amount ?? 0} min={0} name="hourlyRate" step="0.01" type="number" />
              </DrawerField>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <DrawerField label="Status">
                <select className={selectClass} defaultValue={editingTrainer?.status ?? "active"} name="status">
                  <option value="active">Active</option><option value="on_leave">On Leave</option><option value="inactive">Inactive</option>
                </select>
              </DrawerField>
            </div>
          </div>
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-muted-foreground">
              <GitBranch className="size-3.5" /> Gym Assignments
            </h4>
            {hasTrainerSharing ? (
              <div className="rounded-lg border border-border bg-surface-muted p-4">
                <p className="mb-3 text-xs text-muted-foreground">Select additional gyms where this trainer can teach.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dashboard.gyms.filter((g) => editingTrainer ? g.id !== editingTrainer.gym_id : true).map((g) => (
                    <label key={g.id} className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-all hover:border-border-strong",
                      additionalGymIds.includes(g.id) ? "border-accent bg-accent/10 text-accent" : "border-border bg-background"
                    )}>
                      <input type="checkbox" className="size-4 accent-accent" checked={additionalGymIds.includes(g.id)}
                        onChange={() => setAdditionalGymIds((prev) => prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id])} />
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                      <span>{g.name}</span>
                      {additionalGymIds.includes(g.id) && <CheckCircle2 className="ml-auto size-4 text-accent" />}
                    </label>
                  ))}
                </div>
                {additionalGymIds.length > 0 && <input type="hidden" name="additionalGymIds" value={additionalGymIds.join(",")} />}
                {editingTrainer && <p className="mt-3 text-xs text-muted-foreground">Primary gym: <span className="font-bold text-foreground">{dashboard.gyms.find((g) => g.id === editingTrainer.gym_id)?.name}</span></p>}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                <ShieldAlert className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-bold text-muted-foreground">Multi-Gym Trainer Sharing</p>
                <p className="mt-1 text-xs text-muted-foreground">Assign trainers to multiple gyms with an Enterprise plan.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingTrainer ? "Update Trainer" : "Add Trainer"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ ASSIGN MEMBER DRAWER ═══ */}
      <OrgOwnerDrawer description={`Assign a member to ${assigningTrainer?.display_name ?? "trainer"}`} onClose={closeAssign} open={assignDrawerOpen} title="Assign Member to Trainer" size="md">
        <form action={assignFormAction} className="space-y-5">
          <DrawerFormMessage status={assignState.status} message={assignState.message} />
          <input name="trainerId" type="hidden" value={assigningTrainer?.id ?? ""} />
          {assigningTrainer && (
            <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-muted p-4">
              <TrainerAvatar name={assigningTrainer.display_name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black">{assigningTrainer.display_name}</p>
                <p className="text-sm text-muted-foreground">{dashboard.members.filter((m) => m.assigned_trainer_id === assigningTrainer.id).length} members currently assigned</p>
              </div>
            </div>
          )}
          <DrawerField label="Select Member" required>
            <select className={selectClass} value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)} name="memberId" required>
              <option value="">Choose an active member...</option>
              {dashboard.members.filter((m) => m.status === "active" && !m.assigned_trainer_id).map((m) => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.member_code}) — {m.phone ?? "No phone"}</option>
              ))}
            </select>
          </DrawerField>
          {selectedMemberId && (
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
              <div className="flex items-center gap-3">
                <UserPlus className="size-5 text-accent" />
                <div>
                  <p className="text-sm font-bold text-accent">Ready to assign</p>
                  <p className="text-xs text-muted-foreground">{dashboard.members.find((m) => m.id === selectedMemberId)?.full_name} → {assigningTrainer?.display_name}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeAssign} type="button">Cancel</button>
            <DrawerSubmitButton>Assign Member</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ TRAINER DETAIL PANEL ═══ */}
      {detailTrainer && (
        <TrainerDetailPanel
          trainer={detailTrainer} dashboard={dashboard} onClose={() => setDetailTrainer(null)}
          onEdit={openEdit} onAssign={openAssign} hasTrainerSharing={hasTrainerSharing}
          trainerMemberMap={trainerMemberMap}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   STAT DETAIL PANEL
   Clicking a stat card opens this panel with
   relevant detailed data.
   ════════════════════════════════════════════ */
function StatDetailPanel({
  statKey, trainers, activeTrainers, onLeaveTrainers, fullTimeTrainers,
  dashboard, trainerMemberMap, trainerSessionCounts, onClose,
  onEdit, onAssign, onViewDetail,
}: {
  statKey: StatKey;
  trainers: TrainerRow[];
  activeTrainers: TrainerRow[];
  onLeaveTrainers: TrainerRow[];
  fullTimeTrainers: TrainerRow[];
  dashboard: OrganizationOwnerDashboard;
  trainerMemberMap: Map<string, MemberRow[]>;
  trainerSessionCounts: Map<string, number>;
  onClose: () => void;
  onEdit: (t: TrainerRow) => void;
  onAssign: (t: TrainerRow) => void;
  onViewDetail: (t: TrainerRow) => void;
}) {
  const [search, setSearch] = useState("");

  const titleByKey: Record<string, string> = {
    all: "All Trainers",
    active: "Active Trainers",
    on_leave: "Trainers on Leave",
    full_time: "Full-Time Trainers",
    assigned_members: "Member Assignments",
    utilization: "Trainer Utilization",
  };

  const iconByKey: Record<string, ReactNode> = {
    all: <Dumbbell className="size-5" />,
    active: <CheckCircle2 className="size-5" />,
    on_leave: <CalendarDays className="size-5" />,
    full_time: <Award className="size-5" />,
    assigned_members: <UsersRound className="size-5" />,
    utilization: <BarChart3 className="size-5" />,
  };

  const list =
    statKey === "all" ? trainers :
    statKey === "active" ? activeTrainers :
    statKey === "on_leave" ? onLeaveTrainers :
    statKey === "full_time" ? fullTimeTrainers : [];

  const filtered = list.filter((t) =>
    t.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.employee_code ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (t.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (!statKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titleByKey[statKey]}>
        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              {iconByKey[statKey]}
            </div>
            <div>
              <h2 className="text-xl font-black">{titleByKey[statKey]}</h2>
              <p className="text-sm text-muted-foreground">
                {statKey === "assigned_members"
                  ? `${[...trainerMemberMap.values()].reduce((s, m) => s + m.length, 0)} total assignments`
                  : statKey === "utilization"
                  ? `Avg ${dashboard.metrics.avgTrainerUtilization}% across ${dashboard.gyms.length} gyms`
                  : `${filtered.length} trainer${filtered.length !== 1 ? "s" : ""}`
                }
              </p>
            </div>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ── ASSIGNED MEMBERS VIEW ── */}
          {statKey === "assigned_members" ? (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-4 text-center">
                  <p className="text-2xl font-black text-accent">{trainers.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Trainers with members</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 text-center">
                  <p className="text-2xl font-black text-green-600">{[...trainerMemberMap.values()].reduce((s, m) => s + m.length, 0)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total assigned members</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 text-center">
                  <p className="text-2xl font-black text-amber-600">{dashboard.members.filter((m) => !m.assigned_trainer_id && m.status === "active").length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Unassigned active members</p>
                </div>
              </div>

              {/* Trainers with their members */}
              {trainers.filter((t) => (trainerMemberMap.get(t.id)?.length ?? 0) > 0).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-surface-muted p-12 text-center">
                  <UsersRound className="mx-auto size-10 text-muted-foreground" />
                  <p className="mt-3 text-lg font-black">No member assignments</p>
                  <p className="mt-1 text-sm text-muted-foreground">Assign members to trainers to see them grouped here.</p>
                </div>
              ) : trainers.map((t) => {
                const members = trainerMemberMap.get(t.id) ?? [];
                if (members.length === 0) return null;
                return (
                  <Card key={t.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <TrainerAvatar name={t.display_name} size="sm" />
                          <div>
                            <p className="font-black">{t.display_name}</p>
                            <p className="text-xs text-muted-foreground">{dashboard.gyms.find((g) => g.id === t.gym_id)?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">{members.length}</span>
                          <button onClick={() => onAssign(t)} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground" type="button" aria-label="Assign member">
                            <UserPlus className="size-4" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {members.slice(0, 10).map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 transition-all hover:border-border-strong">
                          <div className="flex items-center gap-3 min-w-0">
                            <MemberAvatar name={m.full_name} />
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">{m.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{m.member_code} · {m.phone ?? "—"}</p>
                            </div>
                          </div>
                          <EnterpriseStatusBadge status={m.status} />
                        </div>
                      ))}
                      {members.length > 10 && (
                        <p className="pt-1 text-center text-xs text-muted-foreground">+ {members.length - 10} more</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : /* ── UTILIZATION VIEW ── */
          statKey === "utilization" ? (
            <div className="space-y-6">
              {/* Gym utilization summary */}
              <div className="grid gap-3 md:grid-cols-2">
                {dashboard.gyms.map((gym) => {
                  const gymTrainers = trainers.filter((t) => t.gym_id === gym.id);
                  const gymSessions = dashboard.classSessions.filter((s) => s.gym_id === gym.id);
                  const fillRate = gymSessions.length > 0
                    ? Math.round((gymSessions.filter((s) => s.status !== "cancelled").length / gymSessions.length) * 100)
                    : 0;
                  return (
                    <div key={gym.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-bold">{gym.name}</p>
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{gymTrainers.length} trainers</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Sessions</span>
                          <span className="font-bold">{gymSessions.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Fill Rate</span>
                          <span className="font-bold">{fillRate}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Per-trainer utilization table */}
              <Card>
                <CardHeader><h3 className="font-black">Per-Trainer Session Count</h3></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">
                          <th className="pb-2 pr-4">Trainer</th>
                          <th className="pb-2 pr-4">Gym</th>
                          <th className="pb-2 pr-4">Status</th>
                          <th className="pb-2 text-right">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainers.length === 0 ? (
                          <tr><td className="pt-4 text-center text-muted-foreground" colSpan={4}>No trainers</td></tr>
                        ) : [...trainers]
                          .sort((a, b) => (trainerSessionCounts.get(b.id) ?? 0) - (trainerSessionCounts.get(a.id) ?? 0))
                          .map((t) => {
                            const sessions = trainerSessionCounts.get(t.id) ?? 0;
                            const maxSessions = Math.max(1, ...[...trainerSessionCounts.values()]);
                            const pct = Math.round((sessions / maxSessions) * 100);
                            return (
                              <tr key={t.id} className="border-b border-border last:border-0">
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-2">
                                    <TrainerAvatar name={t.display_name} size="sm" />
                                    <span className="font-bold">{t.display_name}</span>
                                  </div>
                                </td>
                                <td className="py-3 pr-4 text-muted-foreground">{dashboard.gyms.find((g) => g.id === t.gym_id)?.name ?? "—"}</td>
                                <td className="py-3 pr-4"><EnterpriseStatusBadge status={t.status} /></td>
                                <td className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="h-2 w-20 overflow-hidden rounded-full bg-surface-muted">
                                      <div className={cn("h-full rounded-full", pct > 66 ? "bg-green-500" : pct > 33 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="font-black w-8 text-right">{sessions}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ── TRAINER LIST VIEW (all, active, on_leave, full_time) ── */
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Search trainers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Trainer grid */}
              <div className="grid gap-3 md:grid-cols-2">
                {filtered.map((t) => {
                  const gym = dashboard.gyms.find((g) => g.id === t.gym_id);
                  const memberCount = (trainerMemberMap.get(t.id) ?? []).length;
                  const ptRev = dashboard.payments
                    .filter((p) => p.status === "paid" && (trainerMemberMap.get(t.id) ?? []).some((m) => m.id === p.member_id))
                    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

                  return (
                    <div key={t.id} className="group rounded-lg border border-border bg-background p-4 transition-all hover:border-accent/30 hover:shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <TrainerAvatar name={t.display_name} />
                          <div className="min-w-0">
                            <p className="font-bold truncate">{t.display_name}</p>
                            <p className="text-xs text-muted-foreground">{t.employee_code} · {gym?.name ?? "—"}</p>
                          </div>
                        </div>
                        <EnterpriseStatusBadge status={t.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-md bg-surface-muted p-2 text-center">
                          <p className="font-black text-muted-foreground">Members</p>
                          <p className="font-bold">{memberCount}</p>
                        </div>
                        <div className="rounded-md bg-surface-muted p-2 text-center">
                          <p className="font-black text-muted-foreground">Revenue</p>
                          <p className="font-bold">{formatCompactNumber(Math.round(ptRev))}</p>
                        </div>
                        <div className="rounded-md bg-surface-muted p-2 text-center">
                          <p className="font-black text-muted-foreground">Experience</p>
                          <p className="font-bold">{t.years_experience ?? 0}y</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => onViewDetail(t)} className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-all hover:bg-surface-muted" type="button">View Profile</button>
                        <button onClick={() => onEdit(t)} className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-all hover:bg-surface-muted" type="button">Edit</button>
                        <button onClick={() => onAssign(t)} className="flex-1 rounded-md bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition-all hover:bg-accent/20" type="button">Assign</button>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-2 rounded-lg border border-dashed border-border bg-surface-muted p-12 text-center">
                    <Search className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No trainers match your search.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   TRAINER DETAIL PANEL
   ════════════════════════════════════════════ */
function TrainerDetailPanel({
  trainer, dashboard, onClose, onEdit, onAssign, hasTrainerSharing, trainerMemberMap
}: {
  trainer: TrainerRow; dashboard: OrganizationOwnerDashboard; onClose: () => void;
  onEdit: (t: TrainerRow) => void; onAssign: (t: TrainerRow) => void;
  hasTrainerSharing: boolean; trainerMemberMap: Map<string, MemberRow[]>;
}) {
  const gym = dashboard.gyms.find((g) => g.id === trainer.gym_id);
  const assignedMembers = trainerMemberMap.get(trainer.id) ?? [];
  const activeMembers = assignedMembers.filter((m) => m.status === "active");
  const ptRevenue = dashboard.payments
    .filter((p) => p.status === "paid" && assignedMembers.some((m) => m.id === p.member_id))
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const sessionsCount = dashboard.classSessions.filter((s) => s.primary_trainer_id === trainer.id).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${trainer.display_name} details`}>
        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <TrainerAvatar name={trainer.display_name} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black truncate">{trainer.display_name}</h2>
                <EnterpriseStatusBadge status={trainer.status} />
              </div>
              <p className="text-sm text-muted-foreground">{trainer.employee_code} · {gym?.name ?? "—"}</p>
            </div>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {/* QUICK ACTIONS */}
        <div className="flex gap-2 border-b border-border px-5 py-3">
          <Button size="sm" variant="secondary" onClick={() => onEdit(trainer)}><Edit3 className="size-3.5" /> Edit</Button>
          <Button size="sm" variant="secondary" onClick={() => onAssign(trainer)}><UserPlus className="size-3.5" /> Assign Member</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* PROFILE */}
          <Card>
            <CardHeader><div className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" /><h3 className="text-lg font-black">Profile</h3></div></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <InfoRow icon={<Briefcase className="size-4" />} label="Type" value={formatEnterpriseLabel(trainer.employment_type)} />
              <InfoRow icon={<Award className="size-4" />} label="Experience" value={`${trainer.years_experience ?? 0} years`} />
              <InfoRow icon={<Mail className="size-4" />} label="Email" value={trainer.email ?? "—"} />
              <InfoRow icon={<Phone className="size-4" />} label="Phone" value={trainer.phone ?? "—"} />
              <InfoRow icon={<Clock className="size-4" />} label="Hourly Rate" value={trainer.hourly_rate_amount ? `₹${trainer.hourly_rate_amount}` : "—"} />
              <InfoRow icon={<CalendarDays className="size-4" />} label="Joined" value={trainer.joined_at ? new Date(trainer.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
            </CardContent>
          </Card>

          {/* PERFORMANCE */}
          <Card>
            <CardHeader><div className="flex items-center gap-2"><BarChart3 className="size-4 text-muted-foreground" /><h3 className="text-lg font-black">Performance</h3></div></CardHeader>
            <CardContent className="grid grid-cols-4 gap-3">
              <MetricBox value={String(assignedMembers.length)} label="Members" color="text-accent" />
              <MetricBox value={String(activeMembers.length)} label="Active" color="text-green-600" />
              <MetricBox value={String(sessionsCount)} label="Sessions" color="text-blue-600" />
              <MetricBox value={formatCompactNumber(Math.round(ptRevenue))} label="Revenue" color="text-amber-600" />
            </CardContent>
          </Card>

          {/* GYM ASSIGNMENTS */}
          {hasTrainerSharing && (
            <Card>
              <CardHeader><div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><h3 className="text-lg font-black">Gym Assignments</h3></div></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <MapPin className="size-4 text-accent" />
                  <div className="flex-1"><p className="text-sm font-bold">{gym?.name ?? "—"}</p><p className="text-xs text-muted-foreground">Primary gym</p></div>
                  <CheckCircle2 className="size-4 text-green-600" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ASSIGNED MEMBERS */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><UsersRound className="size-4 text-muted-foreground" /><h3 className="text-lg font-black">Assigned Members</h3></div>
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">{activeMembers.length} active</span>
              </div>
            </CardHeader>
            <CardContent>
              {assignedMembers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-center">
                  <UserPlus className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-bold text-muted-foreground">No members assigned</p>
                  <p className="mt-1 text-xs text-muted-foreground">Click "Assign Member" above to link a member.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedMembers.slice(0, 15).map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 transition-all hover:border-border-strong">
                      <div className="flex items-center gap-3 min-w-0">
                        <MemberAvatar name={m.full_name} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{m.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.member_code} · {m.phone ?? "—"}</p>
                        </div>
                      </div>
                      <EnterpriseStatusBadge status={m.status} />
                    </div>
                  ))}
                  {assignedMembers.length > 15 && <p className="pt-2 text-center text-xs text-muted-foreground">+ {assignedMembers.length - 15} more</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex size-8 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

function MetricBox({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-center">
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
