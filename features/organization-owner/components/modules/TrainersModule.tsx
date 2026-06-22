"use client";

import { useCallback, useState, useActionState, useMemo, type ReactNode } from "react";
import { Banknote, Download, Dumbbell, Edit3, Eye, FileText, Percent, Plus, UserRound, UsersRound } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveTrainerAction, assignMemberToTrainerAction } from "@/features/organization-owner/actions/trainer-actions";
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

type TrainersEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; planContext?: OrgPlanContext | null | undefined };
type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-teal-500"];

function TrainerAvatar({ name }: { name: string }) {
  return <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colors[name.length % colors.length]}`}>{name.charAt(0).toUpperCase()}</div>;
}

export function TrainersEnterpriseModule({ dashboard, moduleData, planContext }: TrainersEnterpriseModuleProps) {
  const [activeTab, setActiveTab] = useState<"trainers" | "commissions" | "rates" | "payroll">("trainers");
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [detailTrainer, setDetailTrainer] = useState<TrainerRow | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<TrainerRow | null>(null);
  const [assigningTrainer, setAssigningTrainer] = useState<TrainerRow | null>(null);
  const [state, formAction] = useActionState(saveTrainerAction, initialAuthActionState);
  const [assignState, assignFormAction] = useActionState(assignMemberToTrainerAction, initialAuthActionState);

  const initial = (moduleData?.items ?? dashboard.trainers) as TrainerRow[];
  const { items: trainers, addOptimistic, updateOptimistic } = useOptimisticList<TrainerRow>(initial);

  // ── KPIs ──
  const activeCount = trainers.filter((t) => t.status === "active").length;
  const onLeaveCount = trainers.filter((t) => t.status === "on_leave").length;
  const inactiveCount = trainers.filter((t) => t.status === "inactive").length;
  const fullTimeCount = trainers.filter((t) => t.employment_type === "full_time").length;

  // ── Computed metrics ──
  const totalAssignedMembers = dashboard.members.filter((m) => m.assigned_trainer_id).length;
  const totalTrainerSessions = (dashboard as unknown as { trainerSessions?: Array<unknown> }).trainerSessions?.length ?? 0;

  const openCreate = useCallback(() => { setEditingTrainer(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((t: TrainerRow) => { setEditingTrainer(t); setDrawerOpen(true); }, []);
  const openAssign = useCallback((t: TrainerRow) => { setAssigningTrainer(t); setAssignDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingTrainer(null); }, []);
  const closeAssign = useCallback(() => { setAssignDrawerOpen(false); setAssigningTrainer(null); }, []);
  const handleApplyFilters = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, gymId: f.gymId }); }, [navigate]);

  const items = trainers.map((t) => {
    const gym = dashboard.gyms.find((g) => g.id === t.gym_id);
    const assignedMembers = dashboard.members.filter((m) => m.assigned_trainer_id === t.id);
    const activeMembers = assignedMembers.filter((m) => m.status === "active").length;
    const ptRevenue = dashboard.payments.filter((p) => p.status === "paid" && assignedMembers.some((m) => m.id === p.member_id)).reduce((s, p) => s + Number(p.amount ?? 0), 0);

    return {
      id: t.id,
      title: t.display_name,
      subtitle: `${gym?.name ?? "Unknown gym"} · ${t.employee_code ?? "No code"}`,
      meta: `${formatEnterpriseLabel(t.employment_type)} · ${t.years_experience ?? 0} yrs · Joined ${t.joined_at ? new Date(t.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}`,
      badge: t.status,
      badgeVariant: (t.status === "active" ? "success" : t.status === "on_leave" ? "warning" : "neutral") as "success" | "warning" | "neutral",
      status: t.status,
      avatar: <TrainerAvatar name={t.display_name} />,
      sections: [
        { label: "Type", value: formatEnterpriseLabel(t.employment_type) },
        { label: "Members", value: `${activeMembers} active · ${assignedMembers.length} total` },
        { label: "PT Revenue", value: formatCurrency(ptRevenue) },
        { label: "Experience", value: `${t.years_experience ?? 0} years` },
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

  const trainerList = useMemo(() => trainers.map((t) => ({ id: t.id, display_name: t.display_name })), [trainers]);

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
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ═══ COMMISSION PANEL ═══ */}
      {activeTab === "commissions" ? <TrainerCommissionPanel organizationId={orgId} trainers={trainerList} /> : null}

      {/* ═══ RATES PANEL ═══ */}
      {activeTab === "rates" ? <CommissionRatesPanel organizationId={orgId} trainers={trainerList} /> : null}

      {/* ═══ PAYROLL PANEL ═══ */}
      {activeTab === "payroll" ? <PayrollModule organizationId={orgId} /> : null}

      {/* ═══ TRAINERS TAB (DEFAULT) ═══ */}
      {activeTab !== "trainers" ? null : (
        <>
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total trainer profiles" icon={<Dumbbell className="size-5" />} label="Total Trainers" value={String(trainers.length)} />
        <StatCard detail="Active trainers" icon={<Dumbbell className="size-5" />} label="Active" value={String(activeCount)} />
        <StatCard detail="Trainers on leave" icon={<Dumbbell className="size-5" />} label="On Leave" value={String(onLeaveCount)} />
        <StatCard detail="Full-time trainers" icon={<Dumbbell className="size-5" />} label="Full Time" value={String(fullTimeCount)} />
        <StatCard detail="Members assigned to a trainer" icon={<UsersRound className="size-5" />} label="Assigned Members" value={formatCompactNumber(totalAssignedMembers)} />
        <StatCard detail="Average trainer utilization" icon={<Dumbbell className="size-5" />} label="Utilization" value={`${dashboard.metrics.avgTrainerUtilization}%`} />
      </section>

      {/* ═══ FILTERS ═══ */}
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" }, { value: "on_leave", label: "On Leave" }, { value: "inactive", label: "Inactive" }
          ]},
          { key: "gymId", label: "Branch", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
        ]}
        searchPlaceholder="Search by name, code, email, or phone..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as Record<string, string>}
      />

      {/* ═══ DATA LIST ═══ */}
      <DataList
        selectable
        bulkActions={[
          { label: "Export CSV", onClick: (ids) => {
            const data = trainers.filter((t) => ids.includes(t.id)).map((t) => ({
              name: t.display_name, code: t.employee_code, type: t.employment_type, experience: t.years_experience,
              status: t.status, email: t.email, phone: t.phone, joined: t.joined_at
            }));
            exportToCSV(data, "trainers-selected");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(trainers.map((t) => ({
          name: t.display_name, code: t.employee_code, type: t.employment_type, experience: t.years_experience,
          status: t.status, email: t.email, phone: t.phone, joined: t.joined_at
        })), "all-trainers")}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Trainer</Button>}
        headerTitle="Trainers" items={items}
        totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description={editingTrainer ? `Editing ${editingTrainer.display_name}` : "Add a new trainer"} onClose={closeDrawer} open={drawerOpen} title={editingTrainer ? "Edit Trainer" : "Add Trainer"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingTrainer ? <input name="trainerId" type="hidden" value={editingTrainer.id} /> : null}
          {editingTrainer ? <TrainerAvatar name={editingTrainer.display_name} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Branch" required>
              <select className={selectClass} defaultValue={editingTrainer?.gym_id ?? ""} name="gymId" required>
                <option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Display Name" required>
              <input className={selectClass} defaultValue={editingTrainer?.display_name ?? ""} name="displayName" required type="text" />
            </DrawerField>
            <DrawerField label="Email">
              <input className={selectClass} defaultValue={editingTrainer?.email ?? ""} name="email" type="email" />
            </DrawerField>
            <DrawerField label="Phone">
              <input className={selectClass} defaultValue={editingTrainer?.phone ?? ""} name="phone" type="text" />
            </DrawerField>
            <DrawerField label="Experience (years)">
              <input className={selectClass} defaultValue={editingTrainer?.years_experience ?? 0} min={0} name="yearsExperience" type="number" />
            </DrawerField>
            <DrawerField label="Employment Type">
              <select className={selectClass} defaultValue={editingTrainer?.employment_type ?? "full_time"} name="employmentType">
                <option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contract">Contract</option><option value="consultant">Consultant</option>
              </select>
            </DrawerField>
            <DrawerField label="Hourly Rate (₹)">
              <input className={selectClass} defaultValue={editingTrainer?.hourly_rate_amount ?? 0} min={0} name="hourlyRate" step="0.01" type="number" />
            </DrawerField>
            <DrawerField label="Status">
              <select className={selectClass} defaultValue={editingTrainer?.status ?? "active"} name="status">
                <option value="active">Active</option><option value="on_leave">On Leave</option><option value="inactive">Inactive</option>
              </select>
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingTrainer ? "Update" : "Add Trainer"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ ASSIGN DRAWER ═══ */}
      <OrgOwnerDrawer description={`Assign members to ${assigningTrainer?.display_name ?? "trainer"}`} onClose={closeAssign} open={assignDrawerOpen} title="Assign Member" size="md">
        <form action={assignFormAction} className="space-y-5">
          <DrawerFormMessage status={assignState.status} message={assignState.message} />
          <input name="trainerId" type="hidden" value={assigningTrainer?.id ?? ""} />
          {assigningTrainer ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
              <TrainerAvatar name={assigningTrainer.display_name} />
              <div><p className="text-sm font-bold">{assigningTrainer.display_name}</p><p className="text-xs text-muted-foreground">{dashboard.members.filter((m) => m.assigned_trainer_id === assigningTrainer.id).length} current members</p></div>
            </div>
          ) : null}
          <DrawerField label="Member" required>
            <select className={selectClass} defaultValue="" name="memberId" required>
              <option value="">Select member</option>
              {dashboard.members.filter((m) => m.status === "active" && !m.assigned_trainer_id).map((m) => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.member_code})</option>
              ))}
            </select>
          </DrawerField>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeAssign} type="button">Cancel</button>
            <DrawerSubmitButton>Assign</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ DETAIL PANEL ═══ */}
      {detailTrainer ? <TrainerDetailPanel trainer={detailTrainer} dashboard={dashboard} onClose={() => setDetailTrainer(null)} /> : null}
        </>
      )}
    </div>
  );
}

/* ─── Detail Panel ─── */
function TrainerDetailPanel({ trainer, dashboard, onClose }: { trainer: TrainerRow; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
  const gym = dashboard.gyms.find((g) => g.id === trainer.gym_id);
  const assignedMembers = dashboard.members.filter((m) => m.assigned_trainer_id === trainer.id);
  const activeMembers = assignedMembers.filter((m) => m.status === "active");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${trainer.display_name} details`}>
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <TrainerAvatar name={trainer.display_name} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black truncate">{trainer.display_name}</h2>
                <EnterpriseStatusBadge status={trainer.status} />
              </div>
              <p className="text-sm text-muted-foreground">{trainer.employee_code} · {gym?.name ?? "Unknown"}</p>
            </div>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Dumbbell className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Profile</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{formatEnterpriseLabel(trainer.employment_type)}</p></div>
              <div><p className="text-xs text-muted-foreground">Experience</p><p className="text-sm font-bold">{trainer.years_experience ?? 0} years</p></div>
              <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-bold">{trainer.email ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-bold">{trainer.phone ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Hourly Rate</p><p className="text-sm font-bold">{trainer.hourly_rate_amount ? `₹${trainer.hourly_rate_amount}` : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Joined</p><p className="text-sm font-bold">{trainer.joined_at ? new Date(trainer.joined_at).toLocaleDateString("en-IN") : "—"}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">Assigned Members</h3>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{activeMembers.length} active</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignedMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members assigned.</p>
              ) : assignedMembers.slice(0, 15).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">{m.full_name.charAt(0)}</div>
                    <div><p className="text-sm font-bold">{m.full_name}</p><p className="text-xs text-muted-foreground">{m.member_code} · {m.phone}</p></div>
                  </div>
                  <EnterpriseStatusBadge status={m.status} />
                </div>
              ))}
              {assignedMembers.length > 15 ? <p className="text-xs text-muted-foreground">+ {assignedMembers.length - 15} more members</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
