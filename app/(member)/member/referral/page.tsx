import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getMemberReferralData } from "@/features/member/services/referral-service";
import { getMemberDashboardOverview } from "@/features/memberships/services/membership-service";
import { ReferralDashboard } from "@/features/member/components/referral-dashboard";
import { PageHeader, AnimatedCardSection } from "@/features/member/components/page-wrappers";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Referral Program",
  description: "Invite friends to join Apex Performance Club and earn rewards.",
  path: "/member/referral"
});

export default async function MemberReferralPage() {
  const context = await requireMemberPortalAccess("/member/referral");
  const overview = context.userId ? await getMemberDashboardOverview(context.userId) : null;

  if (!overview?.member?.id || !context.organizationId) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Referrals</h2></CardHeader>
        <CardContent>
          <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No member profile is connected to this login yet.</div>
        </CardContent>
      </Card>
    );
  }

  const referralData = await getMemberReferralData(overview.member.id, context.organizationId).catch(() => null);

  return (
    <div className="space-y-6">
      <PageHeader title="Referral Program" description="Invite friends to join and earn rewards when they become active members." />

      {referralData ? (
        <ReferralDashboard data={referralData} />
      ) : (
        <AnimatedCardSection>
          <Card variant="glass">
            <CardContent className="py-12 text-center">
              <p className="text-sm font-semibold text-muted-foreground">The referral program is not currently active for your gym. Check back later!</p>
            </CardContent>
          </Card>
        </AnimatedCardSection>
      )}
    </div>
  );
}
