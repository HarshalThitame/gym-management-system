"use client";

import { Check, ArrowRight, Globe2, ShieldCheck, MapPin, Hash, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccessRule } from "@/features/organization-owner/actions/cross-branch-actions";

type RuleCreatedDialogProps = {
  open: boolean;
  data: AccessRule | null;
  members: { id: string; full_name: string }[];
  branches: { id: string; name: string }[];
  onClose: () => void;
};

export function RuleCreatedDialog({ open, data, members, branches, onClose }: RuleCreatedDialogProps) {
  if (!open || !data) return null;

  const memberName = data.member_id
    ? members.find((m) => m.id === data.member_id)?.full_name ?? "Specific Member"
    : "All Members";

  const fromBranch = data.from_branch_id
    ? branches.find((b) => b.id === data.from_branch_id)?.name ?? "Specific Branch"
    : "Any Branch";

  const toBranch = branches.find((b) => b.id === data.to_branch_id)?.name ?? data.to_branch_id;

  const details = [
    { icon: Globe2, label: "Rule Name", value: data.name },
    { icon: UserRound, label: "Applies To", value: memberName },
    { icon: MapPin, label: "From", value: fromBranch },
    { icon: MapPin, label: "Target Branch", value: toBranch },
    { icon: ShieldCheck, label: "Access", value: data.is_allowed ? "Allowed" : "Denied" },
    { icon: Hash, label: "Priority", value: String(data.priority ?? 0) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative mx-auto w-full max-w-md animate-[reveal-up_0.5s_cubic-bezier(0.2,0,0,1)_both] rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl"
        role="dialog"
        aria-label="Access rule created successfully"
      >
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-10 text-center text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Check className="size-8" />
          </div>
          <h2 className="relative mt-4 text-2xl font-black tracking-tight">Access Rule Created!</h2>
          <p className="relative mt-1 text-sm text-white/80">{data.name}</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.15s] rounded-xl border border-violet-100 bg-violet-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Rule</p>
                <p className="text-lg font-black text-violet-800">{data.name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${data.is_allowed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {data.is_allowed ? "Allow" : "Deny"}
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
