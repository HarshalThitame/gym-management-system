"use client";

import { useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, MessageSquare, Activity, Dumbbell, UsersRound } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { TrainerSessionStatusForm } from "@/features/training/components/training-forms";
import { AnimatedContainer, AnimatedCard, useStaggerChildren } from "@/components/motion";
import type { TrainerSessionRow } from "@/types/training";
import type { MemberRow } from "@/types/membership";
import type { TrainerAssignmentRow } from "@/types/training";

export function DashboardClient({
  children,
}: {
  children: ReactNode;
}) {
  const { ref, isVisible } = useStaggerChildren({ threshold: 0.05 });

  return (
    <div ref={ref} className="space-y-8">
      <AnimatedContainer isVisible={isVisible}>{children}</AnimatedContainer>
    </div>
  );
}

const sessionColors: Record<string, string> = {
  scheduled: "border-l-accent",
  rescheduled: "border-l-amber-500",
  completed: "border-l-success",
  missed: "border-l-destructive",
  cancelled: "border-l-muted-foreground/30",
};

export function TodayTimeline({
  sessions,
}: {
  sessions: Array<TrainerSessionRow & { member: { id: string; member_code: string; full_name: string; phone: string } | null }>;
}) {
  return (
    <AnimatedCard>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black">Today&apos;s Sessions</h3>
            <p className="text-xs font-semibold text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? "s" : ""} scheduled</p>
          </div>
          <Link
            href="/trainer/sessions"
            className="rounded-lg border border-border bg-surface-muted px-4 py-2 text-xs font-bold transition-all duration-200 hover:border-accent/30 hover:bg-accent/5 hover:shadow-glow-sm"
          >
            View All
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-8 text-center">
              <Calendar className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-bold text-muted-foreground">No sessions today</p>
              <p className="mt-1 text-xs text-muted-foreground">Enjoy your free time or schedule a session above.</p>
            </div>
          ) : (
            sessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, type: "spring", stiffness: 150, damping: 20 }}
                className={cn(
                  "relative rounded-lg border border-border bg-surface-muted/80 p-4 pl-5 transition-all duration-300 hover:shadow-glow-sm hover:border-accent/30",
                  sessionColors[session.status] ?? "border-l-border"
                )}
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{session.member?.full_name ?? "Member"}</p>
                      <TrainingStatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-accent/60" />
                        {session.starts_at.slice(0, 5)} - {session.ends_at.slice(0, 5)}
                      </span>
                      <span className="mx-2">&middot;</span>
                      {session.workout_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === "scheduled" || session.status === "rescheduled" ? (
                      <SessionStatusActions session={session} />
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AnimatedCard>
  );
}

function SessionStatusActions({ session }: { session: TrainerSessionRow }) {
  return (
    <div className="w-full max-w-sm">
      <TrainerSessionStatusForm session={session} />
    </div>
  );
}

export function MemberCardGrid({
  members,
}: {
  members: Array<MemberRow & { assignment: TrainerAssignmentRow | null }>;
}) {
  if (members.length === 0) {
    return (
      <AnimatedCard>
        <div className="p-6">
          <h3 className="text-2xl font-black">Assigned Members</h3>
          <div className="mt-6 rounded-lg border border-dashed border-border bg-surface-muted/50 p-8 text-center">
            <UsersRound className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">No active member assignments yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Members will appear here once assigned by an admin.</p>
          </div>
        </div>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black">Assigned Members</h3>
            <p className="text-xs font-semibold text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
          <Link
            href="/trainer/members"
            className="rounded-lg border border-border bg-surface-muted px-4 py-2 text-xs font-bold transition-all duration-200 hover:border-accent/30 hover:bg-accent/5 hover:shadow-glow-sm"
          >
            Manage
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {members.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 150, damping: 20 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface-muted/50 p-4 transition-all duration-300 hover:border-accent/30 hover:shadow-glow-sm hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-purple-600 text-xs font-black text-white shadow-glow-sm">
                  {member.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{member.full_name}</p>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{member.member_code}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/trainer/progress`}
                  className="flex-1 rounded-md bg-surface px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-accent transition-all duration-200 hover:bg-accent/10 hover:scale-105"
                >
                  Progress
                </Link>
                <Link
                  href={`/trainer/sessions`}
                  className="flex-1 rounded-md bg-surface px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-accent transition-all duration-200 hover:bg-accent/10 hover:scale-105"
                >
                  Sessions
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedCard>
  );
}

export function FloatingQuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const actions = [
    { href: "/trainer/sessions", icon: Calendar, label: "New Session", color: "from-accent to-purple-600" },
    { href: "/trainer/members", icon: MessageSquare, label: "Message", color: "from-emerald-500 to-teal-600" },
    { href: "/trainer/progress", icon: Activity, label: "Log Progress", color: "from-amber-500 to-orange-600" },
    { href: "/trainer/programs", icon: Dumbbell, label: "New Program", color: "from-pink-500 to-rose-600" },
  ];

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3 md:bottom-8">
      <AnimatePresence>
        {isOpen &&
          actions.map((action, index) => (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 200, damping: 20 }}
            >
              <Link
                href={action.href}
                className={cn(
                  "flex items-center gap-2 rounded-full bg-gradient-to-r p-3 text-white shadow-glow-lg transition-all duration-200 hover:scale-110 hover:shadow-glow",
                  action.color
                )}
              >
                <action.icon className="size-5" />
                <span className="pr-1 text-xs font-bold">{action.label}</span>
              </Link>
            </motion.div>
          ))}
      </AnimatePresence>

      <button
        onClick={toggle}
        className={cn(
          "flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-purple-600 text-white shadow-glow-lg transition-all duration-300 hover:scale-110 hover:shadow-glow",
          isOpen && "rotate-45 from-destructive to-red-600"
        )}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}
