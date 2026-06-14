"use client";

import { useCallback, useMemo, useState, useActionState } from "react";
import { CalendarDays, Download, Edit3, Eye, Plus, UsersRound, XCircle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type ClassesEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type ClassSessionRow = Database["public"]["Tables"]["class_sessions"]["Row"];

const CHART_COLORS = ["#16a34a", "#0891b2", "#f59e0b", "#dc2626"];
const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ClassesEnterpriseModule({ dashboard, moduleData }: ClassesEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<ClassSessionRow | null>(null);
  const [editingSession, setEditingSession] = useState<ClassSessionRow | null>(null);
  const [state, formAction] = useActionState(saveClassSessionAction, initialAuthActionState);

  const sessions = (moduleData?.items ?? dashboard.classSessions) as ClassSessionRow[];

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

    return {
      id: s.id,
      title: `${s.session_date} · ${s.starts_at?.slice(0, 5) ?? ""} - ${s.ends_at?.slice(0, 5) ?? ""}`,
      subtitle: `${gym?.name ?? "—"} · ${trainer?.display_name ?? "No trainer"}`,
      meta: `${s.location ?? "No location"} · Booked ${s.booked_count}/${s.capacity} (${sessionFillRate}%) · Waitlist: ${s.waitlist_count ?? 0}`,
      badge: s.status,
      badgeVariant: (s.status === "scheduled" ? "success" : s.status === "cancelled" ? "error" : "neutral") as "success" | "error" | "neutral",
      status: s.status,
      sections: [
        { label: "Date", value: s.session_date },
        { label: "Time", value: `${s.starts_at?.slice(0, 5) ?? ""} - ${s.ends_at?.slice(0, 5) ?? ""}` },
        { label: "Fill Rate", value: `${sessionFillRate}%` },
        { label: "Trainer", value: trainer?.display_name ?? "—" },
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
          { key: "gymId", label: "Gym", options: dashboard.gyms.map((g) => ({ value: g.id, label: g.name })) }
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
        totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description={editingSession ? "Edit class session" : "Schedule a new class session"} onClose={closeDrawer} open={drawerOpen} title={editingSession ? "Edit Session" : "Schedule Class"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingSession ? <input name="sessionId" type="hidden" value={editingSession.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required>
              <select className={selectClass} defaultValue={editingSession?.gym_id ?? ""} name="gymId" required>
                <option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Class ID" required>
              <input className={selectClass} defaultValue={editingSession?.class_id ?? ""} name="classId" required type="text" placeholder="e.g. YOGA-101" />
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
      {detailSession ? <ClassDetailPanel session={detailSession} dashboard={dashboard} onClose={() => setDetailSession(null)} /> : null}
    </div>
  );
}

function ClassDetailPanel({ session, dashboard, onClose }: { session: ClassSessionRow; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
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
            <p className="mt-0.5 text-sm text-muted-foreground">{session.starts_at?.slice(0, 5)} - {session.ends_at?.slice(0, 5)} · Class ID: {session.class_id}</p>
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
              <div><p className="text-xs text-muted-foreground">Class ID</p><p className="text-sm font-bold">{session.class_id}</p></div>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
