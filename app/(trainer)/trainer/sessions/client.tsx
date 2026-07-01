"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, CalendarDays, Filter, Clock, Download, X, User, Tag, FileText } from "lucide-react";
import { AnimatedContainer, AnimatedDrawer, useStaggerChildren } from "@/components/motion";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { TrainerSessionStatusForm } from "@/features/training/components/training-forms";
import { cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import type { TrainerSessionRow } from "@/types/training";

export function SessionsClient({ children }: { children: ReactNode }) {
  const { ref, isVisible } = useStaggerChildren({ threshold: 0.05 });

  return (
    <div ref={ref} className="space-y-8">
      <AnimatedContainer isVisible={isVisible}>
        {children}
      </AnimatedContainer>
    </div>
  );
}

function sessionsToCsv(
  sessions: Array<TrainerSessionRow & { member: { id: string; member_code: string; full_name: string; phone: string } | null }>
): string {
  const headers = ["Date", "Member", "Start", "End", "Workout Type", "Status", "Notes"];
  const rows = sessions.map((s) => [
    s.session_date,
    s.member?.full_name ?? "Unknown",
    s.starts_at.slice(0, 5),
    s.ends_at.slice(0, 5),
    s.workout_type,
    s.status,
    (s.notes ?? "").replace(/[,\n"]/g, " "),
  ]);
  const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
  return [headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n");
}

export function SessionsCalendar({
  sessions,
}: {
  sessions: Array<TrainerSessionRow & { member: { id: string; member_code: string; full_name: string; phone: string } | null }>;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<typeof sessions[number] | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const dateKey = session.session_date;
      const existing = map.get(dateKey) ?? [];
      existing.push(session);
      map.set(dateKey, existing);
    }
    return map;
  }, [sessions]);

  const statusDot = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: "bg-accent",
      rescheduled: "bg-amber-500",
      completed: "bg-success",
      missed: "bg-destructive",
      cancelled: "bg-muted-foreground/40",
    };
    return colors[status] ?? "bg-muted-foreground/40";
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 150, damping: 20 }}
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-premium"
      >
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-accent/5 to-purple-600/5 p-4">
          <button
            onClick={() => setCurrentDate((prev) => subMonths(prev, 1))}
            className="flex size-10 items-center justify-center rounded-lg transition-all duration-200 hover:bg-surface-muted hover:scale-110"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h3 className="text-lg font-black">
            {format(currentDate, "MMMM yyyy")}
          </h3>
          <button
            onClick={() => setCurrentDate((prev) => addMonths(prev, 1))}
            className="flex size-10 items-center justify-center rounded-lg transition-all duration-200 hover:bg-surface-muted hover:scale-110"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-surface-muted/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const daySessions = sessionsByDate.get(dateKey) ?? [];
            const isToday = isSameDay(day, new Date());
            const isCurrent = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-20 border-b border-r border-border/50 p-1.5 transition-all duration-200 hover:bg-surface-muted/50 cursor-pointer",
                  !isCurrent && "bg-surface-muted/30",
                  isToday && "bg-accent/5"
                )}
                onClick={() => daySessions.length > 0 && setSelectedSession(daySessions[0])}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    isToday && "bg-accent text-white",
                    !isCurrent && "text-muted-foreground/50",
                  )}
                >
                  {format(day, "d")}
                </span>
                {daySessions.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {daySessions.slice(0, 3).map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold transition-all duration-200 hover:bg-surface-muted"
                        title={`${session.member?.full_name}: ${session.starts_at.slice(0, 5)}-${session.ends_at.slice(0, 5)}`}
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full", statusDot(session.status))} />
                        <span className="truncate text-muted-foreground">{session.starts_at.slice(0, 5)}</span>
                      </div>
                    ))}
                    {daySessions.length > 3 && (
                      <span className="block px-1 text-[10px] font-bold text-accent">+{daySessions.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedSession && (
          <SessionDetailDrawer session={selectedSession} onClose={() => setSelectedSession(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function SessionDetailDrawer({
  session,
  onClose,
}: {
  session: TrainerSessionRow & { member: { id: string; member_code: string; full_name: string; phone: string } | null };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="relative w-full max-w-lg border-l border-border bg-surface shadow-premium-lg"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="text-lg font-black">Session Details</h3>
            <button
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-lg transition-all duration-200 hover:bg-surface-muted hover:scale-110"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-accent to-purple-600 text-lg font-black text-white shadow-glow-sm">
                  {session.member?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-xl font-black">{session.member?.full_name ?? "Unknown Member"}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{session.member?.member_code}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoTile icon={CalendarDays} label="Date" value={new Date(session.session_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} />
                <InfoTile icon={Clock} label="Time" value={`${session.starts_at.slice(0, 5)} - ${session.ends_at.slice(0, 5)}`} />
                <InfoTile icon={Tag} label="Workout" value={session.workout_type} />
                <InfoTile icon={FileText} label="Status" value={<TrainingStatusBadge status={session.status} />} />
              </div>

              {session.notes && (
                <div className="rounded-lg border border-border bg-surface-muted/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="mt-2 text-sm leading-6">{session.notes}</p>
                </div>
              )}

              <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
                <TrainerSessionStatusForm session={session} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/50 p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

export function SessionsFilteredList({
  sessions,
}: {
  sessions: Array<TrainerSessionRow & { member: { id: string; member_code: string; full_name: string; phone: string } | null }>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      const matchesSearch =
        !search ||
        session.member?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        session.workout_type?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || session.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sessions, search, statusFilter]);

  const handleExport = useCallback(() => {
    const csv = sessionsToCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trainer-sessions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by member or workout..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-border bg-surface-muted pl-10 pr-4 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-11 w-full appearance-none rounded-lg border border-border bg-surface-muted pl-10 pr-8 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-40"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rescheduled">Rescheduled</option>
          </select>
        </div>
        <button
          onClick={handleExport}
          className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface-muted px-4 text-sm font-bold transition-all duration-200 hover:border-accent/30 hover:bg-accent/5 hover:shadow-glow-sm"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-8 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">No sessions found</p>
            <p className="text-xs text-muted-foreground">
              {search || statusFilter !== "all" ? "Try adjusting your filters." : "No upcoming sessions scheduled."}
            </p>
          </div>
        ) : (
          filtered.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, type: "spring", stiffness: 150, damping: 20 }}
              className={cn(
                "rounded-lg border border-border bg-surface-muted/50 p-4 transition-all duration-200 hover:border-accent/30 hover:shadow-glow-sm",
                session.status === "completed" && "opacity-70"
              )}
            >
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{session.member?.full_name ?? "Member"}</p>
                    <TrainingStatusBadge status={session.status} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {new Date(session.session_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {session.starts_at.slice(0, 5)} - {session.ends_at.slice(0, 5)}
                    </span>
                    <span className="text-accent">&middot; {session.workout_type}</span>
                  </p>
                  {session.notes && (
                    <p className="mt-2 text-sm leading-5 text-muted-foreground line-clamp-2">{session.notes}</p>
                  )}
                </div>
                {session.status === "scheduled" || session.status === "rescheduled" ? (
                  <div className="w-full shrink-0 md:w-auto md:max-w-[280px]">
                    <TrainerSessionStatusForm session={session} />
                  </div>
                ) : null}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-xs font-semibold text-muted-foreground">
          Showing {filtered.length} of {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
