import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { MembershipStatusBadge } from "@/features/memberships/components/membership-status-badge";
import { formatMoney, getRemainingDays } from "@/features/memberships/lib/business-rules";
import { getMemberDashboard } from "@/features/memberships/services/membership-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Membership",
  description: "Protected member membership details.",
  path: "/member/membership"
});

export default async function MemberMembershipPage() {
  const context = await requireRole(["member", "super_admin"], "/member/membership");
  const profile = context.userId ? await getMemberDashboard(context.userId) : null;
  const membership = profile?.currentMembership ?? null;
  const plan = profile?.currentPlan ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-black">Membership Details</h2>
          <MembershipStatusBadge status={membership?.status ?? "none"} />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">Membership details are scoped to your signed-in user and protected by RLS.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {membership && plan ? (
          <div className="grid gap-4 md:grid-cols-2">
            <MemberField label="Plan" value={plan.name} />
            <MemberField label="Access Level" value={plan.access_level} />
            <MemberField label="Start Date" value={membership.start_date} />
            <MemberField label="Expiry Date" value={membership.end_date} />
            <MemberField label="Remaining Days" value={String(getRemainingDays(membership.end_date))} />
            <MemberField label="Invoice Amount" value={formatMoney(membership.total_amount)} />
          </div>
        ) : (
          <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No active membership record is connected yet.</div>
        )}
        <ButtonLink href="/membership-plans" variant="accent">Renew Membership</ButtonLink>
      </CardContent>
    </Card>
  );
}

function MemberField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-black capitalize">{value}</p>
    </div>
  );
}
