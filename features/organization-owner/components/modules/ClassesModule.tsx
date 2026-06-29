"use client";

import { useCallback, useMemo, useState, useEffect, useActionState, type ReactNode } from "react";
import { CalendarDays, Download, Dumbbell, Edit3, Eye, Plus, UsersRound, XCircle, GitBranch, Calendar } from "lucide-react";
import { LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveClassSessionAction, cancelClassSessionAction } from "@/features/organization-owner/actions/class-actions";
import { saveOrgClassDefinitionAction } from "@/features/organization-owner/actions/class-definition-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatClassLabel } from "@/features/classes/lib/business-rules";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { useHasFeature } from "@/features/organization-owner/entitlements";
import { NetworkClassCalendar } from "@/features/organization-owner/components/modules/NetworkClassCalendar";
import { CrossGymClassBookingPanel } from "@/features/organization-owner/components/modules/CrossGymClassBookingPanel";
import { ClassCreatedDialog } from "@/features/organization-owner/components/modules/ClassCreatedDialog";
import { SessionCreatedDialog } from "@/features/organization-owner/components/modules/SessionCreatedDialog";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type ClassesEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[]; crossBranchCounts?: Record<string, number> } | undefined };
type ClassSessionRow = Database["public"]["Tables"]["class_sessions"]["Row"];
type ClassDefRow = Database["public"]["Tables"]["classes"]["Row"];

const CHART_COLORS = ["#16a34a", "#0891b2", "#f59e0b", "#dc2626"];
const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ClassesEnterpriseModule({ dashboard, moduleData }: ClassesEnterpriseModuleProps) {
  const [activeTab, setActiveTab] = useState<"sessions" | "calendar" | "cross-gym" | "definitions">("sessions");
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<ClassSessionRow | null>(null);
  const [editingSession, setEditingSession] = useState<ClassSessionRow | null>(null);
  const [state, formAction] = useActionState(saveClassSessionAction, initialAuthActionState);
  const [defDrawerOpen, setDefDrawerOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassDefRow | null>(null);
  const [defState, defFormAction] = useActionState(saveOrgClassDefinitionAction, initialAuthActionState);
  const [successClass, setSuccessClass] = useState<{ id: string; name: string; status: string; classType: string; difficulty: string; durationMinutes: number; defaultCapacity: number; gymName: string } | null>(null);
  const [successSession, setSuccessSession] = useState<{ id: string; sessionDate: string; startsAt: string; endsAt: string; className: string; gymName: string; trainerName: string; location: string; capacity: number } | null>(null);

  useEffect(() => {
    const classData = (defState as Record<string, unknown>).classData as Record<string, string | number> | undefined;
    if (defState.status === "success" && classData) {
      setSuccessClass({
        id: classData.id as string,
        name: classData.name as string,
        status: classData.status as string,
        classType: classData.classType as string,
        difficulty: classData.difficulty as string,
        durationMinutes: classData.durationMinutes as number,
        defaultCapacity: classData.defaultCapacity as number,
        gymName: dashboard.gyms.find((g) => g.id === classData.gymId)?.name ?? (classData.gymId as string),
      });
      setDefDrawerOpen(false);
    }
  }, [defState, dashboard]);

  useEffect(() => {
    const sessionData = (state as Record<string, unknown>).sessionData as Record<string, string | number> | undefined;
    if (state.status === "success" && sessionData) {
      setSuccessSession({
        id: sessionData.id as string,
        sessionDate: sessionData.sessionDate as string,
        startsAt: sessionData.startsAt as string,
        endsAt: sessionData.endsAt as string,
        className: dashboard.classes.find((c) => c.id === sessionData.classId)?.name ?? (sessionData.classId as string),
        gymName: dashboard.gyms.find((g) => g.id === sessionData.gymId)?.name ?? (sessionData.gymId as string),
        trainerName: sessionData.trainerId ? (dashboard.trainers.find((t) => t.id === sessionData.trainerId)?.display_name ?? "") : "",
        location: sessionData.location as string,
        capacity: sessionData.capacity as number,
      });
      setDrawerOpen(false);
    }
  }, [state, dashboard]);

  const hasCrossBranchFeature = useHasFeature("cross_branch_class_booking");
  const hasNetworkCalendar = useHasFeature("network_wide_class_calendar");

  const tabs = useMemo(() => {
    const t: Array<{ key: typeof activeTab; label: string; icon: ReactNode }> = [
      { key: "sessions", label: "Sessions", icon: <CalendarDays className="size-4" /> },
    ];
    if (hasNetworkCalendar) {
      t.push({ key: "calendar", label: "Network Calendar", icon: <Calendar className="size-4" /> });
    }
    if (hasCrossBranchFeature) {
      t.push({ key: "cross-gym", label: "Cross-Gym", icon: <GitBranch className="size-4" /> });
    }
    t.push({ key: "definitions", label: "Definitions", icon: <Dumbbell className="size-4" /> });
    return t;
  }, [hasNetworkCalendar, hasCrossBranchFeature]);

  const sessions = (moduleData?.items ?? dashboard.classSessions) as ClassSessionRow[];
  const crossBranchCounts = moduleData?.crossBranchCounts ?? {};
  const [selectedGymId, setSelectedGymId] = useState(editingSession?.gym_id ?? "");

  const openCreate = useCallback(() => { setEditingSession(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((s: ClassSessionRow) => { setEditingSession(s); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingSession(null); }, []);
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, gymId: f.gymId, dateFrom: f.dateFrom, dateTo: f.dateTo }); }, [navigate]);

  const handleCancel = useCallback(async (sessionId: string) => {
    const fd = new FormData(); fd.set("sessionId", sessionId);
    const r = await cancelClassSessionAction({ status: "idle", message: null } as never, fd);
    showToast(r.status === "success" ? "Cancelled" : (r.message || "Failed"), r.status === "success" ? "success" : "error");
  }, []);

  // ── KPIs ──
  const scheduled = sessions.filter((s) => s.status === "scheduled").length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const cancelled = sessions.filter((s) => s.status === "cancelled").length;
  const totalBooked = sessions.reduce((t, s) => t + Number(s.booked_count ?? 0), 0);
  const totalCapacity = sessions.reduce((t, s) => t + Number(s.capacity ?? 0), 0);
  const totalWaitlist = sessions.reduce((t, s) => t + Number(s.waitlist_count ?? 0), 0);
  const totalCrossBranch = Object.values(crossBranchCounts).reduce((t, v) => t + v, 0);
  const fillRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

  // ── Weekly trend ──
  const weeklyTrend = useMemo(() => {
    const byDate = new Map<string, { booked: number; capacity: number }>();
    for (const s of sessions) {
      const day = s.session_date?.slice(0, 10) ?? "unknown";
      const prev = byDate.get(day) ?? { booked: 0, capacity: 0 };
      byDate.set(day, { booked: prev.booked + Number(s.booked_count ?? 0), capacity: prev.capacity + Number(s.capacity ?? 0) });
    }
    return Array.from(byDate.entries()).slice(-14).map(([date, d]) => ({
      date: date.slice(5), fillRate: d.capacity > 0 ? Math.round((d.booked / d.capacity) * 100) : 0
    }));
  }, [sessions]);

  const items = sessions.map((s) => {
    const gym = dashboard.gyms.find((g) => g.id === s.gym_id);
    const trainer = s.primary_trainer_id ? dashboard.trainers.find((t) => t.id === s.primary_trainer_id) : null;
    const sessionFillRate = Number(s.capacity) > 0 ? Math.round((Number(s.booked_count ?? 0) / Number(s.capacity)) * 100) : 0;
    const crossCount = crossBranchCounts[s.id] ?? 0;

    return {
      id: s.id,
      title: `${s.session_date} · ${s.starts_at?.slice(0, 5) ?? ""} - ${s.ends_at?.slice(0, 5) ?? ""}`,
      subtitle: `${gym?.name ?? "—"} · ${trainer?.display_name ?? "No trainer"}${hasCrossBranchFeature && crossCount > 0 ? ` · Cross-branch: ${crossCount}` : ""}`,
      meta: `${s.location ?? "No location"} · Booked ${s.booked_count}/${s.capacity} (${sessionFillRate}%) · Waitlist: ${s.waitlist_count ?? 0}`,
      badge: hasCrossBranchFeature && crossCount > 0 ? `${crossCount} cross-branch` : s.status,
      badgeVariant: hasCrossBranchFeature && crossCount > 0 ? "info" : (s.status === "scheduled" ? "success" : s.status === "cancelled" ? "error" : "neutral") as "success" | "error" | "neutral" | "info",
      status: s.status,
      sections: [
        { label: "Date", value: s.session_date },
        { label: "Time", value: `${s.starts_at?.slice(0, 5) ?? ""} - ${s.ends_at?.slice(0, 5) ?? ""}` },
        { label: "Fill Rate", value: `${sessionFillRate}%` },
        { label: "Trainer", value: trainer?.display_name ?? "—" },
        ...(hasCrossBranchFeature && crossCount > 0 ? [{ label: "Cross-branch", value: `${crossCount}`, icon: <GitBranch className="size-3.5" /> }] : []),
      ],
      actions: [
        { label: "Details", onClick: () => setDetailSession(s), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        ...(s.status === "scheduled"
          ? [{ label: "Edit", onClick: () => openEdit(s), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
             { label: "Cancel", onClick: () => handleCancel(s.id), variant: "destructive" as const, icon: <XCircle className="size-3.5" /> }]
          : [])
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? sessions.length;

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

      {/* ═══ NETWORK CALENDAR TAB ═══ */}
      {activeTab === "calendar" ? <NetworkClassCalendar dashboard={dashboard} /> : null}

      {/* ═══ CROSS-GYM BOOKING TAB ═══ */}
      {activeTab === "cross-gym" ? <CrossGymClassBookingPanel dashboard={dashboard} /> : null}

      {/* ═══ DEFINITIONS TAB ═══ */}
      {activeTab !== "definitions" ? null : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">Class Definitions</h3>
            <Button onClick={() => { setEditingClass(null); setDefDrawerOpen(true); }} size="sm" variant="primary">
              <Plus className="size-4" /> Create Class
            </Button>
          </div>

          {dashboard.classes.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-muted p-12 text-center">
              <Dumbbell className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-4 text-lg font-black">No classes defined yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create your first class so you can schedule sessions.</p>
              <Button className="mt-4" onClick={() => { setEditingClass(null); setDefDrawerOpen(true); }} variant="primary">
                <Plus className="size-4" /> Create Class
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.classes.map((c) => {
                const gym = c.gym_id ? dashboard.gyms.find((g) => g.id === c.gym_id) : null;
                return (
                  <div className="rounded-lg border border-border bg-surface p-4" key={c.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black">{c.name}</h4>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatClassLabel(c.class_type)} · {formatClassLabel(c.difficulty)}</p>
                      </div>
                      <EnterpriseStatusBadge status={c.status} />
                    </div>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground line-clamp-2">{c.description}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border bg-background p-2">
                        <p className="font-black text-muted-foreground">Capacity</p>
                        <p className="font-bold">{c.default_capacity}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-2">
                        <p className="font-black text-muted-foreground">Duration</p>
                        <p className="font-bold">{c.duration_minutes}m</p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-2">
                        <p className="font-black text-muted-foreground">Gym</p>
                        <p className="font-bold">{gym?.name ?? "—"}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-2">
                        <p className="font-black text-muted-foreground">Created By</p>
                        <p className="font-bold">{c.created_by ?? "—"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button onClick={() => { setEditingClass(c); setDefDrawerOpen(true); }} size="sm" variant="secondary">
                        <Edit3 className="size-3.5" /> Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ CLASS DEFINITION CREATE/EDIT DRAWER ═══ */}
          <OrgOwnerDrawer description={editingClass ? "Edit class definition" : "Create a new class definition"} onClose={() => { setDefDrawerOpen(false); setEditingClass(null); }} open={defDrawerOpen} title={editingClass ? "Edit Class" : "Create Class"} size="lg">
            <form action={defFormAction} className="space-y-5">
              <DrawerFormMessage status={defState.status} message={defState.message} />
              {editingClass ? <input name="classId" type="hidden" value={editingClass.id} /> : null}
              <div className="grid gap-5 md:grid-cols-2">
                <DrawerField label="Class Name" required>
                  <input className={selectClass} defaultValue={editingClass?.name ?? ""} name="name" required type="text" placeholder="e.g. Signature Strength Club" />
                </DrawerField>
                <DrawerField label="Branch" required>
                  <select className={selectClass} defaultValue={editingClass?.gym_id ?? ""} name="gymId" required>
                    <option value="">Select gym</option>
                    {dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </DrawerField>
              </div>
              <DrawerField label="Description">
                <textarea className={selectClass + " min-h-[80px]"} defaultValue={editingClass?.description ?? ""} name="description" placeholder="Describe this class" />
              </DrawerField>
              <div className="grid gap-5 md:grid-cols-3">
                <DrawerField label="Class Type">
                  <select className={selectClass} defaultValue={editingClass?.class_type ?? "group_class"} name="classType">
                    <option value="group_class">Group class</option>
                    <option value="workshop">Workshop</option>
                    <option value="special_event">Special event</option>
                    <option value="challenge">Challenge</option>
                    <option value="camp">Camp</option>
                    <option value="group_pt">Group PT</option>
                  </select>
                </DrawerField>
                <DrawerField label="Difficulty">
                  <select className={selectClass} defaultValue={editingClass?.difficulty ?? "all_levels"} name="difficulty">
                    <option value="all_levels">All levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </DrawerField>
                <DrawerField label="Status">
                  <select className={selectClass} defaultValue={editingClass?.status ?? "draft"} name="status">
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </DrawerField>
              </div>
              <div className="grid gap-5 md:grid-cols-4">
                <DrawerField label="Duration (min)">
                  <input className={selectClass} defaultValue={editingClass?.duration_minutes ?? 60} min={15} max={240} name="durationMinutes" type="number" />
                </DrawerField>
                <DrawerField label="Capacity">
                  <input className={selectClass} defaultValue={editingClass?.default_capacity ?? 24} min={1} name="defaultCapacity" type="number" />
                </DrawerField>
                <DrawerField label="Price ($)">
                  <input className={selectClass} defaultValue={(editingClass?.price_amount ?? 0) / 100} min={0} name="priceAmount" type="number" />
                </DrawerField>
                <DrawerField label="Booking Window (days)">
                  <input className={selectClass} defaultValue={editingClass?.booking_window_days ?? 14} min={0} name="bookingWindowDays" type="number" />
                </DrawerField>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                <DrawerField label="Trainer">
                  <select className={selectClass} defaultValue="" name="primaryTrainerId">
                    <option value="">No trainer</option>
                    {dashboard.trainers.filter((t) => t.status === "active").map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                  </select>
                </DrawerField>
                <DrawerField label="Location">
                  <input className={selectClass} defaultValue={editingClass?.location ?? ""} name="location" type="text" placeholder="Studio A" />
                </DrawerField>
                <DrawerField label="Membership Access">
                  <select className={selectClass} defaultValue={editingClass?.membership_access ?? "active_members"} name="membershipAccess">
                    <option value="active_members">Active members</option>
                    <option value="premium_only">Premium only</option>
                    <option value="staff_approval">Staff approval</option>
                    <option value="public_event">Public event</option>
                  </select>
                </DrawerField>
              </div>
              <div className="flex justify-end gap-3 border-t border-border pt-6">
                <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={() => { setDefDrawerOpen(false); setEditingClass(null); }} type="button">Cancel</button>
                <DrawerSubmitButton>{editingClass ? "Update" : "Create"}</DrawerSubmitButton>
              </div>
            </form>
          </OrgOwnerDrawer>
        </div>
      )}

      {/* ═══ SESSIONS TAB (DEFAULT) ═══ */}
      {activeTab !== "sessions" ? null : (
        <>
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total class sessions" icon={<CalendarDays className="size-5" />} label="Total" value={String(sessions.length)} />
        <StatCard detail="Scheduled upcoming sessions" icon={<CalendarDays className="size-5" />} label="Scheduled" value={String(scheduled)} />
        <StatCard detail="Completed sessions" icon={<CalendarDays className="size-5" />} label="Completed" value={String(completed)} />
        <StatCard detail="Cancelled sessions" icon={<CalendarDays className="size-5" />} label="Cancelled" value={String(cancelled)} />
        <StatCard detail="Total booked seats" icon={<UsersRound className="size-5" />} label="Booked" value={formatCompactNumber(totalBooked)} />
        <StatCard detail="Overall class fill rate" icon={<CalendarDays className="size-5" />} label="Fill Rate" status={fillRate >= 80 ? "good" : fillRate >= 50 ? "watch" : "risk"} value={`${fillRate}%`} />
        <StatCard detail="Waitlisted requests" icon={<UsersRound className="size-5" />} label="Waitlist" value={formatCompactNumber(totalWaitlist)} />
        <StatCard detail="Total class capacity" icon={<CalendarDays className="size-5" />} label="Capacity" value={formatCompactNumber(totalCapacity)} />
        {hasCrossBranchFeature ? <StatCard detail="Cross-branch bookings" icon={<GitBranch className="size-5" />} label="Cross-branch" value={formatCompactNumber(totalCrossBranch)} /> : null}
      </section>

      {/* ═══ FILL RATE CHART ═══ */}
      <Card>
        <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Analytics</p><h3 className="text-2xl font-black">Fill Rate Trend (14 days)</h3></CardHeader>
        <CardContent>
          {weeklyTrend.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No class data yet.</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrend}>
                  <Tooltip />
                  <Line dataKey="fillRate" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} tickLine={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ FILTERS + DATA LIST ═══ */}
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }
          ]},
          { key: "gymId", label: "Branch", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
        ]}
        searchPlaceholder="Search by date, location, or trainer..."
        onApply={handleApply}
        activeFilters={filters as unknown as Record<string, string>}
      />

      <DataList
        selectable
        bulkActions={[
          { label: "Cancel Selected", onClick: async (ids) => { for (const id of ids) { const fd = new FormData(); fd.set("sessionId", id); await cancelClassSessionAction({ status: "idle", message: null } as never, fd); } showToast(`${ids.length} session(s) cancelled`, "success"); }, variant: "destructive" as const, icon: <XCircle className="size-3.5" /> },
          { label: "Export CSV", onClick: (ids) => { const data = sessions.filter((s) => ids.includes(s.id)).map((s) => ({ date: s.session_date, start: s.starts_at, end: s.ends_at, status: s.status, booked: s.booked_count, capacity: s.capacity, location: s.location })); exportToCSV(data, "classes-selected"); }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(sessions.map((s) => ({ date: s.session_date, start: s.starts_at, end: s.ends_at, status: s.status, booked: s.booked_count, capacity: s.capacity, waitlist: s.waitlist_count, location: s.location, gym_id: s.gym_id, trainer_id: s.primary_trainer_id })), "all-classes")}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Schedule Class</Button>}
        headerTitle="Class Sessions" items={items}
        emptyTitle="No class sessions yet"
        emptyDescription="Schedule your first class session to get started."
        emptyAction={{ label: "Schedule Class", onClick: openCreate }}
        totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description={editingSession ? "Edit class session" : "Schedule a new class session"} onClose={closeDrawer} open={drawerOpen} title={editingSession ? "Edit Session" : "Schedule Class"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingSession ? <input name="sessionId" type="hidden" value={editingSession.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Branch" required>
              <select className={selectClass} defaultValue={editingSession?.gym_id ?? ""} name="gymId" required onChange={(e) => setSelectedGymId(e.target.value)}>
                <option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Class" required>
              <select className={selectClass} defaultValue={editingSession?.class_id ?? ""} name="classId" required>
                <option value="">Select class</option>
                {dashboard.classes.filter((c) => c.gym_id === selectedGymId || !selectedGymId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </DrawerField>
            <DrawerField label="Session Date" required>
              <input className={selectClass} defaultValue={editingSession?.session_date ?? ""} name="sessionDate" required type="date" />
            </DrawerField>
            <DrawerField label="Start Time" required>
              <input className={selectClass} defaultValue={editingSession?.starts_at ?? ""} name="startsAt" required type="time" />
            </DrawerField>
            <DrawerField label="End Time" required>
              <input className={selectClass} defaultValue={editingSession?.ends_at ?? ""} name="endsAt" required type="time" />
            </DrawerField>
            <DrawerField label="Capacity">
              <input className={selectClass} defaultValue={editingSession?.capacity ?? 30} min={1} name="capacity" type="number" />
            </DrawerField>
            <DrawerField label="Trainer">
              <select className={selectClass} defaultValue={editingSession?.primary_trainer_id ?? ""} name="trainerId">
                <option value="">No trainer</option>
                {dashboard.trainers.filter((t) => t.status === "active").map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Location">
              <input className={selectClass} defaultValue={editingSession?.location ?? ""} name="location" type="text" placeholder="Studio A, Floor 2" />
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingSession ? "Update" : "Schedule"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ DETAIL PANEL ═══ */}
      {detailSession ? <ClassDetailPanel session={detailSession} dashboard={dashboard} crossBranchCount={crossBranchCounts[detailSession.id] ?? 0} hasCrossBranchFeature={hasCrossBranchFeature} onClose={() => setDetailSession(null)} /> : null}
        </>
      )}

      <ClassCreatedDialog open={!!successClass} data={successClass} onClose={() => setSuccessClass(null)} />
      <SessionCreatedDialog open={!!successSession} data={successSession} onClose={() => setSuccessSession(null)} />
    </div>
  );
}

function ClassDetailPanel({ session, dashboard, crossBranchCount, hasCrossBranchFeature, onClose }: { session: ClassSessionRow; dashboard: OrganizationOwnerDashboard; crossBranchCount: number; hasCrossBranchFeature: boolean; onClose: () => void }) {
  const gym = dashboard.gyms.find((g) => g.id === session.gym_id);
  const trainer = session.primary_trainer_id ? dashboard.trainers.find((t) => t.id === session.primary_trainer_id) : null;
  const fillRate = Number(session.capacity) > 0 ? Math.round((Number(session.booked_count ?? 0) / Number(session.capacity)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Session details">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{session.session_date}</h2>
              <EnterpriseStatusBadge status={session.status} />
            </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{session.starts_at?.slice(0, 5)} - {session.ends_at?.slice(0, 5)} · {dashboard.classes.find((c) => c.id === session.class_id)?.name ?? session.class_id}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><CalendarDays className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Schedule</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-bold">{session.session_date}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={session.status} /></div>
              <div><p className="text-xs text-muted-foreground">Start</p><p className="text-sm font-bold">{session.starts_at?.slice(0, 5) ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">End</p><p className="text-sm font-bold">{session.ends_at?.slice(0, 5) ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Location</p><p className="text-sm font-bold">{session.location ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Class</p><p className="text-sm font-bold">{dashboard.classes.find((c) => c.id === session.class_id)?.name ?? session.class_id}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Assignment</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Gym</p><p className="text-sm font-bold">{gym?.name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Trainer</p><p className="text-sm font-bold">{trainer?.display_name ?? "—"}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Capacity</h3></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{session.booked_count}/{session.capacity} booked</span>
                <span className={`text-lg font-black ${fillRate >= 80 ? "text-green-600" : fillRate >= 50 ? "text-amber-600" : "text-red-600"}`}>{fillRate}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className={`h-full rounded-full transition-all ${fillRate >= 80 ? "bg-green-500" : fillRate >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${fillRate}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-background p-3 text-center">
                  <p className="text-xs text-muted-foreground">Waitlist</p>
                  <p className="text-xl font-black">{session.waitlist_count ?? 0}</p>
                </div>
                <div className="rounded-md border border-border bg-background p-3 text-center">
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="text-xl font-black">{Math.max(0, Number(session.capacity) - Number(session.booked_count ?? 0))}</p>
                </div>
              </div>
              {hasCrossBranchFeature && crossBranchCount > 0 ? (
                <div className="rounded-md border border-border bg-background p-3 text-center mt-3">
                  <p className="text-xs text-muted-foreground">Cross-branch bookings</p>
                  <p className="text-xl font-black">{crossBranchCount}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
