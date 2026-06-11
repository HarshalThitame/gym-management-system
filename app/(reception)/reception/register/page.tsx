import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MemberOnboardingForm } from "@/features/memberships/components/member-onboarding-form";
import { listActiveMembershipPlans } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Registration",
  description: "Reception member registration workspace for assigned-gym front desk operations.",
  path: "/reception/register"
});

export default async function ReceptionRegisterPage() {
  const scope = await requireReceptionScope("/reception/register");
  const plans = await listActiveMembershipPlans(scope.gymId);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Registration</p>
        <h2 className="mt-2 text-3xl font-black">Member registration</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Create assigned-gym member records, capture emergency contacts and medical notes, attach a membership plan, and generate billing-ready membership records.
        </p>
      </section>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Quick Member Registration</h3>
          <p className="text-sm leading-6 text-muted-foreground">Mandatory fields are validated before the record is saved. Profile photos are restricted to JPG, PNG, and WebP.</p>
        </CardHeader>
        <CardContent>
          {plans.length > 0 ? <MemberOnboardingForm plans={plans} /> : <EmptyState text="No active membership plans are available for registration." />}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
