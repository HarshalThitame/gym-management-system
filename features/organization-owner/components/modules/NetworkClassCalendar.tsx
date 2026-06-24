"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, LockIcon, X } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { useHasFeature } from "@/features/organization-owner/entitlements";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { getNetworkCalendar, type NetworkCalendarData, type CalendarSession, type CalendarGym } from "@/features/organization-owner/actions/class-calendar-actions";
import { cn } from "@/lib/utils";

type Props = {
  dashboard: OrganizationOwnerDashboard;
};

type ViewMode = "month" | "week" | "day";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const days: Date[] = [];
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) days.push(new Date(year, month - 1, -i));
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month - 1, i));
  const endPadding = 7 - (days.length % 7);
  if (endPadding < 7) for (let i = 1; i <= endPadding; i++) days.push(new Date(year, month, i));
  return days;
}

function getWeekDays(year: number, month: number, weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function NetworkClassCalendar({ dashboard }: Props) {
  const hasFeature = useHasFeature("network_wide_class_calendar");
  if (!hasFeature) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-surface-muted mb-4">
          <LockIcon className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-black">Network Calendar</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          View all class sessions across all branches in one unified calendar view.
          Upgrade to the Enterprise plan to unlock this feature.
        </p>
      </div>
    );
  }
  return <NetworkCalendarInner dashboard={dashboard} />;
}

function NetworkCalendarInner({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [weekStart, setWeekStart] = useState(getWeekStart(now));
  const [data, setData] = useState<NetworkCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hiddenGymIds, setHiddenGymIds] = useState<Set<string>>(new Set());
  const [classTypeFilter, setClassTypeFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailSession, setDetailSession] = useState<CalendarSession | null>(null);

  const orgId = dashboard.organization.id;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getNetworkCalendar(orgId, year, month);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, year, month]);

  useEffect(() => { void loadData(); }, [loadData]);

  const classTypes = useMemo(() => {
    const names = new Set<string>();
    data?.sessions.forEach((s) => names.add(s.class_name));
    return Array.from(names).sort();
  }, [data]);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    return data.sessions.filter((s) => {
      if (hiddenGymIds.has(s.gym_id)) return false;
      if (classTypeFilter !== "all" && s.class_name !== classTypeFilter) return false;
      return true;
    });
  }, [data, hiddenGymIds, classTypeFilter]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    for (const s of filteredSessions) {
      const arr = map.get(s.session_date) ?? [];
      arr.push(s);
      map.set(s.session_date, arr);
    }
    return map;
  }, [filteredSessions]);

  const gymColorMap = useMemo(() => {
    const map = new Map<string, CalendarGym>();
    if (!data) return map;
    for (const g of data.gyms) map.set(g.id, g);
    return map;
  }, [data]);

  const prevMonth = useCallback(() => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  }, [month]);

  const goToday = useCallback(() => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
    setWeekStart(getWeekStart(t));
    setSelectedDate(null);
  }, []);

  const prevWeek = useCallback(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
    setSelectedDate(null);
  }, [weekStart]);

  const nextWeek = useCallback(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
    setSelectedDate(null);
  }, [weekStart]);

  const toggleGym = useCallback((gymId: string) => {
    setHiddenGymIds((prev) => {
      const next = new Set(prev);
      if (next.has(gymId)) next.delete(gymId);
      else next.add(gymId);
      return next;
    });
  }, []);

  const days = useMemo(() => {
    if (viewMode === "month") return getDaysInMonth(year, month);
    if (viewMode === "week") return getWeekDays(year, month, weekStart);
    const dayNum = selectedDate ? parseInt(selectedDate.split("-")[2] ?? "", 10) : now.getDate();
    return [new Date(year, month - 1, dayNum || now.getDate())];
  }, [viewMode, year, month, weekStart, selectedDate, now]);

  const selectedSessions = selectedDate ? (sessionsByDate.get(selectedDate) ?? []) : [];
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* ═══ VIEW TOGGLE ═══ */}
              <div className="flex rounded-lg border border-border bg-surface-muted p-0.5 mr-2">
                {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-bold capitalize transition",
                      viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button onClick={viewMode === "week" ? prevWeek : prevMonth} className="flex size-9 items-center justify-center rounded-md border border-border hover:bg-surface-muted" aria-label="Previous">
                <ChevronLeft className="size-4" />
              </button>
              <h3 className="text-xl font-black">{monthLabel}</h3>
              <button onClick={viewMode === "week" ? nextWeek : nextMonth} className="flex size-9 items-center justify-center rounded-md border border-border hover:bg-surface-muted" aria-label="Next">
                <ChevronRight className="size-4" />
              </button>
              <button onClick={goToday} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-surface-muted">Today</button>
            </div>
            <div className="flex items-center gap-2">
              {/* ═══ CLASS TYPE FILTER ═══ */}
              <select
                value={classTypeFilter}
                onChange={(e) => setClassTypeFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-bold focus:border-primary focus:outline-none"
              >
                <option value="all">All Class Types</option>
                {classTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          {/* ═══ GYM FILTERS ═══ */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {data?.gyms.map((gym) => (
              <label
                key={gym.id}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition",
                  hiddenGymIds.has(gym.id) ? "border-border text-muted-foreground opacity-50" : "border-current"
                )}
                style={hiddenGymIds.has(gym.id) ? undefined : { borderColor: gym.color, color: gym.color }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: gym.color }} />
                {gym.name}
                <input type="checkbox" className="sr-only" checked={!hiddenGymIds.has(gym.id)} onChange={() => toggleGym(gym.id)} />
              </label>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading calendar...</p>
            </div>
          ) : viewMode === "month" ? (
            <>
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1 text-center text-xs font-black uppercase text-muted-foreground">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-t border-border">
                {days.map((date, idx) => {
                  const dateStr = formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
                  const isCurrentMonth = date.getMonth() === month - 1;
                  const isToday = dateStr === formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
                  const sessions = sessionsByDate.get(dateStr) ?? [];
                  const isSelected = dateStr === selectedDate;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={cn(
                        "relative flex flex-col border-b border-r border-border p-1.5 text-left transition hover:bg-surface-muted min-h-[72px]",
                        !isCurrentMonth && "bg-surface-muted/30",
                        isToday && "bg-accent/5",
                        isSelected && "ring-2 ring-primary ring-inset"
                      )}
                    >
                      <span className={cn("text-xs font-bold mb-1", isToday ? "text-accent" : isCurrentMonth ? "text-foreground" : "text-muted-foreground")}>{date.getDate()}</span>
                      <div className="flex flex-wrap gap-1">
                        {sessions.slice(0, 3).map((s) => {
                          const gym = gymColorMap.get(s.gym_id);
                          return (
                            <div key={s.id} className="group relative">
                              <span className="block size-1.5 rounded-full cursor-pointer" style={{ backgroundColor: gym?.color ?? "#888" }} onClick={(e) => { e.stopPropagation(); setDetailSession(s); }} />
                              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded-md border border-border bg-background px-2 py-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                <p className="text-xs font-bold">{s.class_name}</p>
                                <p className="text-[10px] text-muted-foreground">{gym?.name} · {s.starts_at.slice(0, 5)} - {s.ends_at.slice(0, 5)}</p>
                                {s.trainer_name ? <p className="text-[10px] text-muted-foreground">Trainer: {s.trainer_name}</p> : null}
                                <p className="text-[10px] text-muted-foreground">Booked: {s.booked_count}/{s.capacity}</p>
                              </div>
                            </div>
                          );
                        })}
                        {sessions.length > 3 ? <span className="text-[10px] font-bold text-muted-foreground">+{sessions.length - 3}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* ═══ WEEK / DAY VIEW = simple list ═══ */
            <div className="space-y-1">
              {days.map((date) => {
                const dateStr = formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
                const sessions = sessionsByDate.get(dateStr) ?? [];
                const dayLabel = date.toLocaleDateString("default", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={dateStr} className="rounded-md border border-border p-3">
                    <p className="text-sm font-black mb-1">{dayLabel}</p>
                    {sessions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No classes</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {sessions.map((s) => {
                          const gym = gymColorMap.get(s.gym_id);
                          return (
                            <button
                              key={s.id}
                              onClick={() => setDetailSession(s)}
                              className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold hover:bg-surface-muted"
                              style={{ borderColor: gym?.color ?? "#888" }}
                            >
                              <span className="size-1.5 rounded-full" style={{ backgroundColor: gym?.color ?? "#888" }} />
                              {s.class_name} {s.starts_at.slice(0, 5)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SELECTED DAY CLASS LIST ═══ */}
      {selectedDate && selectedSessions.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">
                Classes on {new Date(selectedDate + "T00:00:00").toLocaleDateString("default", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <span className="text-sm text-muted-foreground">{selectedSessions.length} session{selectedSessions.length !== 1 ? "s" : ""}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedSessions.map((s) => {
                const gym = gymColorMap.get(s.gym_id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setDetailSession(s)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background p-3 text-left hover:bg-surface-muted transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: gym?.color ?? "#888" }} />
                      <div>
                        <p className="text-sm font-bold">{s.class_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {gym?.name ?? "—"} · {s.starts_at.slice(0, 5)} - {s.ends_at.slice(0, 5)}
                          {s.trainer_name ? ` · ${s.trainer_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold">{s.booked_count}/{s.capacity}</p>
                        <p className="text-xs text-muted-foreground">booked</p>
                      </div>
                      {s.waitlist_count > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">+{s.waitlist_count} waitlist</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : selectedDate ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No classes on this day.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ═══ LEGEND ═══ */}
      {data && data.gyms.length > 0 ? (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="font-bold">Gyms:</span>
          {data.gyms.map((gym) => (
            <span key={gym.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: gym.color }} />
              {gym.name}
            </span>
          ))}
        </div>
      ) : null}

      {/* ═══ CLASS DETAIL DRAWER ═══ */}
      {detailSession ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={() => setDetailSession(null)}>
          <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Class details">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black truncate">{detailSession.class_name}</h2>
                <p className="text-sm text-muted-foreground">{detailSession.session_date} · {detailSession.starts_at.slice(0, 5)} - {detailSession.ends_at.slice(0, 5)}</p>
              </div>
              <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => setDetailSession(null)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <Card>
                <CardHeader><h3 className="text-lg font-black">Schedule</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-bold">{detailSession.session_date}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={detailSession.status} /></div>
                  <div><p className="text-xs text-muted-foreground">Start</p><p className="text-sm font-bold">{detailSession.starts_at.slice(0, 5)}</p></div>
                  <div><p className="text-xs text-muted-foreground">End</p><p className="text-sm font-bold">{detailSession.ends_at.slice(0, 5)}</p></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><h3 className="text-lg font-black">Assignment</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Gym</p><p className="text-sm font-bold">{gymColorMap.get(detailSession.gym_id)?.name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Trainer</p><p className="text-sm font-bold">{detailSession.trainer_name ?? "—"}</p></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><h3 className="text-lg font-black">Capacity</h3></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{detailSession.booked_count}/{detailSession.capacity} booked</span>
                    <span className="text-lg font-black">{detailSession.capacity > 0 ? Math.round((detailSession.booked_count / detailSession.capacity) * 100) : 0}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${detailSession.capacity > 0 ? Math.round((detailSession.booked_count / detailSession.capacity) * 100) : 0}%` }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
