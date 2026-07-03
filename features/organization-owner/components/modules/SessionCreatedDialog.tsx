"use client";

import { Check, ArrowRight, CalendarDays, Clock, MapPin, Users, Building2, Dumbbell, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type SessionCreatedData = {
  id: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  className: string;
  gymName: string;
  trainerName: string;
  location: string;
  capacity: number;
};

type SessionCreatedDialogProps = {
  open: boolean;
  data: SessionCreatedData | null;
  onClose: () => void;
};

export function SessionCreatedDialog({ open, data, onClose }: SessionCreatedDialogProps) {
  if (!open || !data) return null;

  const details = [
    { icon: Dumbbell, label: "Class", value: data.className },
    { icon: Building2, label: "Gym", value: data.gymName },
    { icon: CalendarDays, label: "Date", value: data.sessionDate },
    { icon: Clock, label: "Time", value: `${data.startsAt.slice(0, 5)} - ${data.endsAt.slice(0, 5)}` },
    { icon: UserRound, label: "Trainer", value: data.trainerName || "No trainer" },
    { icon: Users, label: "Capacity", value: String(data.capacity) },
    ...(data.location ? [{ icon: MapPin as typeof MapPin, label: "Location", value: data.location }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative mx-auto w-full max-w-md animate-[reveal-up_0.5s_cubic-bezier(0.2,0,0,1)_both] rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl"
        role="dialog"
        aria-label="Class session scheduled"
      >
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-10 text-center text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Check className="size-8" />
          </div>
          <h2 className="relative mt-4 text-2xl font-black tracking-tight">Session Scheduled!</h2>
          <p className="relative mt-1 text-sm text-white/80">{data.className}</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.15s] rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Date & Time</p>
                <p className="text-lg font-black text-emerald-800">{data.sessionDate}</p>
                <p className="text-sm text-emerald-700">{data.startsAt.slice(0, 5)} - {data.endsAt.slice(0, 5)}</p>
              </div>
              <div className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                {data.capacity} seats
              </div>
            </div>
          </div>

          <div className="animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.25s] space-y-0 divide-y divide-border rounded-xl border border-border">
            {details.map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 text-sm">
                <item.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{item.label}</span>
                <span className="ml-auto font-semibold text-right">{item.value}</span>
              </div>
            ))}
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full gap-2 py-6 text-base"
            onClick={onClose}
            type="button"
          >
            Got it
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
