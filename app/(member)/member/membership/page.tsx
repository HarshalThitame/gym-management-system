import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PaymentCheckoutButton } from "@/features/billing/components/payment-checkout-button";
import { MembershipStatusBadge } from "@/features/memberships/components/membership-status-badge";
import { formatMoney, getRemainingDays } from "@/features/memberships/lib/business-rules";
import { getMemberDashboard } from "@/features/memberships/services/membership-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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
  let pendingPayment: Database["public"]["Tables"]["payments"]["Row"] | null = null;

  if (membership) {
    const supabase = await createSupabaseServerClient();
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("membership_id", membership.id)
      .in("status", ["pending", "processing", "failed"])
      .order("created_at", { ascending: false })
      .limit(1);
    pendingPayment = payments?.[0] ?? null;
  }

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
            <MemberField label="Payment Status" value={membership.payment_status.replace(/_/g, " ")} />
          </div>
        ) : (
          <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No active membership record is connected yet.</div>
        )}
        {pendingPayment ? (
          <div className="rounded-md border border-border bg-surface-muted p-4">
            <p className="text-sm font-black">Pending online payment</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Complete this payment to settle your current membership invoice.</p>
            <div className="mt-3">
              <PaymentCheckoutButton
                amount={pendingPayment.amount}
                memberEmail={profile?.member.email}
                memberName={profile?.member.full_name}
                memberPhone={profile?.member.phone}
                paymentId={pendingPayment.id}
              />
            </div>
            <div className="mt-3">
              <ButtonLink href="/member/payments" variant="secondary">View Payment History</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/member/payments" variant="secondary">View Payment History</ButtonLink>
            <ButtonLink href="/contact?interest=membership-renewal" variant="accent">Request Renewal</ButtonLink>
          </div>
        )}
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
