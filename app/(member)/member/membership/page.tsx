import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PaymentCheckoutButton } from "@/features/billing/components/payment-checkout-button";
import { MembershipStatusBadge } from "@/features/memberships/components/membership-status-badge";
import type { MembershipStatus } from "@/types/membership";
import { formatMoney, getRemainingDays } from "@/features/memberships/lib/business-rules";
import { getMemberDashboard } from "@/features/memberships/services/membership-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection } from "@/features/member/components/page-wrappers";
import { DigitalMembershipCard } from "@/features/member/components/digital-membership-card";
import { getPlanDurationDays } from "@/features/memberships/lib/plan-utils";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const metadata: Metadata = createMetadata({
  title: "Member Membership",
  description: "Protected member membership details.",
  path: "/member/membership"
});

export default async function MemberMembershipPage() {
  const context = await requireMemberPortalAccess("/member/membership");
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
    <div className="space-y-6">
      <PageHeader title="Membership Details" description="Membership details are scoped to your signed-in user and protected by RLS." />

      {membership && plan && (
        <DigitalMembershipCard
          memberName={profile?.member?.full_name ?? "Member"}
          memberCode={profile?.member?.member_code ?? ""}
          planName={plan.name}
          membershipStatus={membership.status}
          remainingDays={getRemainingDays(membership.end_date)}
          totalDays={getPlanDurationDays(plan.plan_type)}
          gymName="Apex Performance Club"
        />
      )}

      <AnimatedCardSection>
        <Card variant="glass">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black">Current Plan</h2>
              <MembershipStatusBadge status={(membership?.status ?? "none") as MembershipStatus | "none"} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {membership && plan ? (
              <div className="grid gap-4 md:grid-cols-2">
                <MemberField label="Plan" value={plan.name} />
                <MemberField label="Access Level" value={plan.access_level} />
                <MemberField label="Start Date" value={membership.start_date} />
                <MemberField label="Expiry Date" value={membership.end_date} />
                <MemberField label="Remaining Days" value={String(getRemainingDays(membership.end_date))} />
                <MemberField label="Invoice Amount" value={formatMoney(membership.total_amount ?? 0)} />
                <MemberField label="Payment Status" value={membership.payment_status.replace(/_/g, " ")} />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm font-semibold text-slate">No active membership record is connected yet.</div>
            )}
            {pendingPayment ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                <p className="text-sm font-bold text-amber-300">Pending online payment</p>
                <p className="mt-1 text-xs text-slate">Complete this payment to settle your current membership invoice.</p>
                <div className="mt-4">
                  <PaymentCheckoutButton
                    amount={pendingPayment.amount}
                    memberEmail={profile?.member.email}
                    memberName={profile?.member.full_name}
                    memberPhone={profile?.member.phone}
                    paymentId={pendingPayment.id}
                  />
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/member/payments" variant="outline-cinematic">View Payment History</ButtonLink>
              <ButtonLink href="/contact?interest=membership-renewal" variant="primary-gradient">Request Renewal</ButtonLink>
            </div>
          </CardContent>
        </Card>
      </AnimatedCardSection>
    </div>
  );
}

function MemberField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-all duration-300">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">{label}</p>
      <p className="mt-1.5 font-bold text-mono-member text-white capitalize">{value}</p>
    </div>
  );
}
