"use client";

import { Check, ArrowRight, Building2, MapPin, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type GymCreatedData = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  status: string;
};

type GymCreatedDialogProps = {
  open: boolean;
  data: GymCreatedData | null;
  onClose: () => void;
};

export function GymCreatedDialog({ open, data, onClose }: GymCreatedDialogProps) {
  if (!open || !data) return null;

  const statusColor =
    data.status === "active" ? "bg-emerald-100 text-emerald-800" :
    data.status === "suspended" ? "bg-red-100 text-red-700" :
    "bg-slate-100 text-slate-600";

  const details = [
    { icon: Building2, label: "Gym Name", value: data.name },
    { icon: MapPin, label: "Slug", value: data.slug },
    { icon: Clock, label: "Timezone", value: data.timezone },
    { icon: ShieldCheck, label: "Status", value: data.status.charAt(0).toUpperCase() + data.status.slice(1) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative mx-auto w-full max-w-md animate-[reveal-up_0.5s_cubic-bezier(0.2,0,0,1)_both] rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl"
        role="dialog"
        aria-label="Gym created successfully"
      >
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-10 text-center text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Check className="size-8" />
          </div>
          <h2 className="relative mt-4 text-2xl font-black tracking-tight">Gym Created!</h2>
          <p className="relative mt-1 text-sm text-white/80">{data.name}</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.15s] rounded-xl border border-sky-100 bg-sky-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Location</p>
                <p className="text-lg font-black text-sky-800">{data.name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}>
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </span>
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

          <Button variant="primary" size="lg" className="w-full gap-2 py-6 text-base" onClick={onClose} type="button">
            Got it
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
