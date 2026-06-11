import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { MemberOnboardingForm } from "@/features/memberships/components/member-onboarding-form";
import { listActiveMembershipPlans } from "@/features/memberships/services/membership-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Add Member",
  description: "Onboard a new member and assign their first membership.",
  path: "/admin/members/new"
});

export default async function NewMemberPage() {
  const scope = await requireGymAdminScope("/admin/members/new");
  const plans = await listActiveMembershipPlans(scope.gymId);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-black">Add New Member</h2>
        <p className="text-sm leading-6 text-muted-foreground">Create a member profile, generate a member ID, assign the first membership, and upload profile media.</p>
      </CardHeader>
      <CardContent>
        {plans.length > 0 ? (
          <MemberOnboardingForm plans={plans} />
        ) : (
          <div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">Create an active membership plan before onboarding members.</div>
        )}
      </CardContent>
    </Card>
  );
}
