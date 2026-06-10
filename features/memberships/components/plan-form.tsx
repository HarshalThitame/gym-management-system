"use client";

import { useActionState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { MembershipPlanRow } from "@/types/membership";
import { planTypeDefaultDurations } from "../lib/business-rules";
import { planFeatureCatalog, parsePlanFeatures } from "../lib/feature-catalog";
import { saveMembershipPlanAction } from "../actions/membership-actions";

type PlanFormProps = {
  plan?: MembershipPlanRow;
};

export function PlanForm({ plan }: PlanFormProps) {
  const [state, formAction] = useActionState(saveMembershipPlanAction, initialAuthActionState);
  const features = parsePlanFeatures(plan?.features);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <input name="planId" type="hidden" value={plan?.id ?? ""} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`name-${plan?.id ?? "new"}`}>Plan name</label>
          <Input id={`name-${plan?.id ?? "new"}`} name="name" defaultValue={plan?.name ?? ""} placeholder="Elite Annual Coaching" />
          <FieldError message={state.fieldErrors?.name?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`planType-${plan?.id ?? "new"}`}>Plan type</label>
          <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" defaultValue={plan?.plan_type ?? "monthly"} id={`planType-${plan?.id ?? "new"}`} name="planType">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Half-Yearly</option>
            <option value="annual">Annual</option>
            <option value="custom">Custom</option>
          </select>
          <FieldError message={state.fieldErrors?.planType?.[0]} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor={`description-${plan?.id ?? "new"}`}>Description</label>
        <Textarea id={`description-${plan?.id ?? "new"}`} name="description" defaultValue={plan?.description ?? ""} placeholder="Premium training access with structured coaching support." />
        <FieldError message={state.fieldErrors?.description?.[0]} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`durationDays-${plan?.id ?? "new"}`}>Duration days</label>
          <Input id={`durationDays-${plan?.id ?? "new"}`} min={1} name="durationDays" type="number" defaultValue={plan?.duration_days ?? planTypeDefaultDurations.monthly} />
          <FieldError message={state.fieldErrors?.durationDays?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`priceAmount-${plan?.id ?? "new"}`}>Price</label>
          <Input id={`priceAmount-${plan?.id ?? "new"}`} min={0} name="priceAmount" step="0.01" type="number" defaultValue={plan ? plan.price_amount / 100 : 0} />
          <FieldError message={state.fieldErrors?.priceAmount?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`joiningFeeAmount-${plan?.id ?? "new"}`}>Joining fee</label>
          <Input id={`joiningFeeAmount-${plan?.id ?? "new"}`} min={0} name="joiningFeeAmount" step="0.01" type="number" defaultValue={plan ? plan.joining_fee_amount / 100 : 0} />
          <FieldError message={state.fieldErrors?.joiningFeeAmount?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`displayOrder-${plan?.id ?? "new"}`}>Display order</label>
          <Input id={`displayOrder-${plan?.id ?? "new"}`} min={0} name="displayOrder" type="number" defaultValue={plan?.display_order ?? 100} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`accessLevel-${plan?.id ?? "new"}`}>Access level</label>
          <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" defaultValue={plan?.access_level ?? "standard"} id={`accessLevel-${plan?.id ?? "new"}`} name="accessLevel">
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
            <option value="elite">Elite</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor={`status-${plan?.id ?? "new"}`}>Status</label>
          <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" defaultValue={plan?.status ?? "active"} id={`status-${plan?.id ?? "new"}`} name="status">
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-black">Plan features</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {planFeatureCatalog.map((feature) => {
            const existing = features.find((item) => item.key === feature.key);
            return (
              <label className="flex items-center gap-3 rounded-md bg-surface-muted p-3 text-sm font-semibold" key={feature.key}>
                <input defaultChecked={existing?.included ?? feature.key === "gym_access"} name="features" type="checkbox" value={feature.key} />
                <span className="flex-1">{feature.label}</span>
                {feature.unit ? (
                  <Input
                    aria-label={`${feature.label} quantity`}
                    className="h-9 w-24"
                    min={0}
                    name={`featureQuantity:${feature.key}`}
                    type="number"
                    defaultValue={existing?.quantity ?? ""}
                  />
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm font-bold">
        <input defaultChecked={plan?.is_public ?? true} name="isPublic" type="checkbox" />
        Show this plan in member-facing selections
      </label>

      <AuthSubmitButton>{plan ? "Update Plan" : "Create Plan"}</AuthSubmitButton>
    </form>
  );
}
