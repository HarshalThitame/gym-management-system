import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PlanForm } from "@/features/memberships/components/plan-form";
import { PlanStatusForm } from "@/features/memberships/components/plan-status-form";
import { formatMoney } from "@/features/memberships/lib/business-rules";
import { parsePlanFeatures } from "@/features/memberships/lib/feature-catalog";
import { listMembershipPlans } from "@/features/memberships/services/membership-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Membership Plans",
  description: "Create, edit, activate, and archive gym membership plans.",
  path: "/admin/membership-plans"
});

export default async function MembershipPlansPage() {
  const context = await requireRole(["super_admin", "gym_admin"], "/admin/membership-plans");
  const plans = await listMembershipPlans(context.profile?.gym_id ?? null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Plan Catalog</p>
          <h2 className="mt-2 text-3xl font-black">Membership Plans</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage monthly, quarterly, half-yearly, annual, and custom plans with flexible feature definitions.</p>
        </div>
        <ButtonLink href="/membership-plans" variant="secondary">Public Pricing</ButtonLink>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Create Plan</h3>
          <p className="text-sm leading-6 text-muted-foreground">New plans can be set active immediately or saved as draft for review.</p>
        </CardHeader>
        <CardContent>
          <PlanForm />
        </CardContent>
      </Card>

      <div className="grid gap-5">
        {plans.map((plan) => {
          const features = parsePlanFeatures(plan.features).filter((feature) => feature.included);
          return (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-black">{plan.name}</h3>
                      <Badge variant={plan.status === "active" ? "premium" : "neutral"}>{plan.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-3xl font-black">{formatMoney(plan.price_amount, plan.currency)}</p>
                    <p className="text-sm font-semibold text-muted-foreground">{plan.duration_days} days · {plan.plan_type.replace("_", " ")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-3">
                  {features.map((feature) => (
                    <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-bold" key={feature.key}>
                      {feature.label}{feature.quantity ? ` · ${feature.quantity}` : ""}
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <details className="rounded-lg border border-border bg-surface-muted p-4">
                  <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.12em]">Edit plan</summary>
                  <div className="mt-5">
                    <PlanForm plan={plan} />
                  </div>
                </details>
                <PlanStatusForm plan={plan} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
