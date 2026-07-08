import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { SignOutButton } from "@/components/pwa/sign-out-button";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { signOutAction } from "@/features/auth/actions/auth-actions";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Access Pending",
  description: "Your Apex account is signed in, but portal access needs an assigned role before you can continue.",
  path: "/unauthorized"
});

type UnauthorizedPageProps = {
  searchParams: Promise<{
    reason?: string;
  }>;
};

export default async function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const params = await searchParams;
  const isTenantMismatch = params.reason === "tenant";
  const isFeatureUnavailable = params.reason === "feature_unavailable";
  const isSubscriptionSuspended = params.reason === "subscription_suspended";
  const isSubscriptionCancelled = params.reason === "subscription_cancelled";
  const isBillingAccessWindow = isSubscriptionCancelled || isSubscriptionSuspended;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="inline-flex size-12 items-center justify-center rounded-md bg-warning/10 text-warning">
            <ShieldAlert aria-hidden="true" className="size-6" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            {isTenantMismatch ? "Tenant access blocked" : isFeatureUnavailable ? "Feature unavailable" : isBillingAccessWindow ? "Billing access" : "Access pending"}
          </p>
          <h1 className="mt-2 text-3xl font-black text-foreground">
            {isTenantMismatch
              ? "This account belongs to a different gym."
              : isFeatureUnavailable
                ? "This page is not available for your current plan."
                : isSubscriptionCancelled
                  ? "Your subscription has been cancelled."
                  : isSubscriptionSuspended
                    ? "Your subscription is suspended."
                    : "Your portal role is not active yet."}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {isTenantMismatch
              ? "You are signed in, but this domain is assigned to another tenant. Sign out and use the correct gym domain, or ask the gym team to update your access."
              : isFeatureUnavailable
                ? "Your role can use this portal, but this specific page is hidden unless the organization plan includes it. Ask an organization owner to upgrade the plan if this workflow is required."
                : isSubscriptionCancelled
                  ? "Your organization subscription is cancelled, but billing history remains available during the retention window. Reactivate the plan to restore full access."
                  : isSubscriptionSuspended
                    ? "Your organization subscription is suspended. Contact support or the organization owner to restore access."
                : "This account is signed in, but it does not have a member, trainer, receptionist, admin, or super admin role assigned. Ask the gym team to activate the correct role, then sign in again."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <form action={signOutAction} id="sign-out-form-mobile">
            <SignOutButton />
          </form>
          <ButtonLink className="w-full" href="/" variant="secondary">
            Back to website
          </ButtonLink>
        </CardContent>
      </Card>
    </main>
  );
}
