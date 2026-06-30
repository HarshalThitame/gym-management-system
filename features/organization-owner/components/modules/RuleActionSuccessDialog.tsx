"use client";

import { Check, ArrowRight, Globe2, ShieldCheck, MapPin, Hash, UserRound, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccessRule } from "@/features/organization-owner/actions/cross-branch-actions";

type RuleAction = "created" | "updated" | "deleted";

type RuleActionSuccessDialogProps = {
  open: boolean;
  data: AccessRule | null;
  action: RuleAction;
  members: { id: string; full_name: string }[];
  branches: { id: string; name: string }[];
  onClose: () => void;
};

const actionConfig: Record<RuleAction, {
  gradient: string;
  icon: typeof Check;
  title: string;
  badgeBg: string;
  textColor: string;
}> = {
  created: {
    gradient: "from-violet-600 to-indigo-600",
    icon: Check,
    title: "Access Rule Created!",
    badgeBg: "bg-violet-50 border-violet-100",
    textColor: "text-violet-800",
  },
  updated: {
    gradient: "from-blue-600 to-cyan-600",
    icon: Sparkles,
    title: "Access Rule Updated!",
    badgeBg: "bg-blue-50 border-blue-100",
    textColor: "text-blue-800",
  },
  deleted: {
    gradient: "from-red-600 to-orange-600",
    icon: Trash2,
    title: "Access Rule Deleted!",
    badgeBg: "bg-red-50 border-red-100",
    textColor: "text-red-800",
  },
};

export function RuleActionSuccessDialog({ open, data, action, members, branches, onClose }: RuleActionSuccessDialogProps) {
  if (!open || !data) return null;

  const cfg = actionConfig[action];

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

  const statusLabel = action === "deleted"
    ? "Deleted"
    : data.is_allowed
      ? "Allow"
      : "Deny";

  const statusColor = action === "deleted"
    ? "bg-red-100 text-red-700"
    : data.is_allowed
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative mx-auto w-full max-w-md animate-[reveal-up_0.5s_cubic-bezier(0.2,0,0,1)_both] rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl"
        role="dialog"
        aria-label={cfg.title.toLowerCase()}
      >
        <div className={`relative overflow-hidden rounded-t-2xl bg-gradient-to-r ${cfg.gradient} px-6 py-10 text-center text-white`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <cfg.icon className="size-8" />
          </div>
          <h2 className="relative mt-4 text-2xl font-black tracking-tight">{cfg.title}</h2>
          <p className="relative mt-1 text-sm text-white/80">{data.name}</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className={`animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.15s] rounded-xl border ${cfg.badgeBg} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Rule</p>
                <p className={`text-lg font-black ${cfg.textColor}`}>{data.name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}>
                {statusLabel}
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
