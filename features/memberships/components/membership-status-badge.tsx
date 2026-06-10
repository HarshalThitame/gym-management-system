import { membershipStatusTone } from "../lib/business-rules";
import type { MembershipStatus } from "@/types/membership";

type MembershipStatusBadgeProps = {
  status: MembershipStatus | "none";
};

export function MembershipStatusBadge({ status }: MembershipStatusBadgeProps) {
  if (status === "none") {
    return <span className="inline-flex rounded-md border border-border bg-surface-muted px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">No plan</span>;
  }

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${membershipStatusTone(status)}`}>
      {status}
    </span>
  );
}
