"use client";

import { useActionState } from "react";
import { Trash2, CalendarX, Plus, Clock, Sun, Monitor, Sunrise, Sunset, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveSelfAvailabilityAction, deleteSelfAvailabilityAction, requestTimeOffAction, cancelTimeOffAction } from "@/features/training/actions/trainer-self-service-actions";
import type { TrainerAvailabilityRow, TrainerTimeOffRow } from "@/types/training";

const dayIcons = [Sun, Monitor, Sunrise, Sunset, Moon, Sun, Monitor];
const dayColors = [
  "from-red-500 to-orange-500",
  "from-orange-500 to-amber-500",
  "from-amber-500 to-yellow-500",
  "from-yellow-500 to-green-500",
  "from-green-500 to-emerald-500",
  "from-emerald-500 to-teal-500",
  "from-teal-500 to-cyan-500",
];

function DayIcon({ day, className }: { day: number; className?: string }) {
  const Icon = dayIcons[day] ?? Sun;
  return <Icon className={className} />;
}

export function AvailabilityForm() {
  const [state, formAction, pending] = useActionState(saveSelfAvailabilityAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="dayOfWeek">Day</label>
          <select
            id="dayOfWeek"
            name="dayOfWeek"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            required
          >
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => (
              <option key={day} value={i}>{day}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="isActive">Status</label>
          <select
            id="isActive"
            name="isActive"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            defaultValue="true"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="startsAt">Start Time</label>
          <input
            id="startsAt"
            name="startsAt"
            type="time"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="endsAt">End Time</label>
          <input
            id="endsAt"
            name="endsAt"
            type="time"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="breakStartsAt">Break Start (optional)</label>
          <input
            id="breakStartsAt"
            name="breakStartsAt"
            type="time"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="breakEndsAt">Break End (optional)</label>
          <input
            id="breakEndsAt"
            name="breakEndsAt"
            type="time"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {state?.status === "error" && (
        <p className="text-sm font-bold text-destructive animate-shake">{state.message}</p>
      )}
      {state?.status === "success" && (
        <p className="text-sm font-bold text-success">{state.message}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        <Plus className="mr-2 size-4" />
        {pending ? "Saving..." : "Add Availability Slot"}
      </Button>
    </form>
  );
}

export function AvailabilitySlotList({
  availability,
  dayNames,
}: {
  availability: TrainerAvailabilityRow[];
  dayNames: string[];
}) {
  const slotsByDay = Array.from({ length: 7 }, (_, i) =>
    availability.filter((a) => a.day_of_week === i)
  );

  if (availability.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-8 text-center">
        <Clock className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-bold text-muted-foreground">No availability set yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Add your weekly availability slots above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Your Schedule</p>
      {slotsByDay.map((slots, dayIndex) =>
        slots.length > 0 ? (
          <div key={dayIndex} className="group rounded-lg border border-border bg-surface-muted/50 p-3 transition-all duration-200 hover:border-accent/30 hover:shadow-glow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("grid size-8 place-items-center rounded-md bg-gradient-to-br text-white shadow-sm", dayColors[dayIndex])}>
                  <DayIcon day={dayIndex} className="size-4" />
                </div>
                <p className="text-sm font-bold">{dayNames[dayIndex]}</p>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {slot.starts_at.slice(0, 5)} - {slot.ends_at.slice(0, 5)}
                    </span>
                    {slot.break_starts_at && (
                      <span className="text-xs text-muted-foreground">
                        Break: {slot.break_starts_at.slice(0, 5)}-{slot.break_ends_at?.slice(0, 5)}
                      </span>
                    )}
                  </div>
                  <form action={deleteSelfAvailabilityAction}>
                    <input type="hidden" name="availabilityId" value={slot.id} />
                    <button
                      type="submit"
                      className="text-muted-foreground/50 transition-all duration-200 hover:text-destructive hover:scale-110"
                      aria-label="Delete availability slot"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

export function TimeOffForm() {
  const [state, formAction, pending] = useActionState(requestTimeOffAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="timeOffStartsAt">Start Date</label>
          <input
            id="timeOffStartsAt"
            name="startsAt"
            type="date"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="timeOffEndsAt">End Date</label>
          <input
            id="timeOffEndsAt"
            name="endsAt"
            type="date"
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="reason">Reason</label>
        <textarea
          id="reason"
          name="reason"
          rows={2}
          className="flex w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="e.g., Personal leave, medical appointment..."
          required
        />
      </div>

      {state?.status === "error" && (
        <p className="text-sm font-bold text-destructive animate-shake">{state.message}</p>
      )}
      {state?.status === "success" && (
        <p className="text-sm font-bold text-success">{state.message}</p>
      )}

      <Button type="submit" disabled={pending} variant="accent" className="w-full">
        <CalendarX className="mr-2 size-4" />
        {pending ? "Submitting..." : "Request Time Off"}
      </Button>
    </form>
  );
}

export function TimeOffList({ timeOff }: { timeOff: TrainerTimeOffRow[] }) {
  const statusColors: Record<string, string> = {
    requested: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  };

  if (timeOff.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-8 text-center">
        <CalendarX className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-bold text-muted-foreground">No time-off requests</p>
        <p className="mt-1 text-xs text-muted-foreground">Use the form above to request time off.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Request History</p>
      {timeOff.map((entry) => (
        <div key={entry.id} className="group rounded-lg border border-border bg-surface-muted/50 p-3 transition-all duration-200 hover:border-accent/30">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">
                  {new Date(entry.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" - "}
                  {new Date(entry.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", statusColors[entry.status] ?? "")}>
                  {entry.status}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{entry.reason}</p>
            </div>
            {entry.status === "requested" && (
              <form action={cancelTimeOffAction}>
                <input type="hidden" name="timeOffId" value={entry.id} />
                <button
                  type="submit"
                  className="shrink-0 text-muted-foreground/50 transition-all duration-200 hover:text-destructive hover:scale-110"
                  aria-label="Cancel time-off request"
                >
                  <Trash2 className="size-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
