"use client";

import { useActionState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { MembershipPlanRow } from "@/types/membership";
import { formatDateInput } from "../lib/business-rules";
import { onboardMemberAction } from "../actions/membership-actions";

type MemberOnboardingFormProps = {
  plans: MembershipPlanRow[];
};

export function MemberOnboardingForm({ plans }: MemberOnboardingFormProps) {
  const [state, formAction] = useActionState(onboardMemberAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="fullName">Full name</label>
          <Input id="fullName" name="fullName" />
          <FieldError message={state.fieldErrors?.fullName?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="phone">Phone</label>
          <Input id="phone" name="phone" type="tel" />
          <FieldError message={state.fieldErrors?.phone?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="email">Email</label>
          <Input id="email" name="email" type="email" />
          <FieldError message={state.fieldErrors?.email?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="dateOfBirth">Date of birth</label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="gender">Gender</label>
          <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" id="gender" name="gender" defaultValue="">
            <option value="">Not specified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="profilePhoto">Profile photo</label>
          <Input accept="image/jpeg,image/png,image/webp" id="profilePhoto" name="profilePhoto" type="file" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="emergencyContactName">Emergency contact</label>
          <Input id="emergencyContactName" name="emergencyContactName" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="emergencyContactPhone">Emergency phone</label>
          <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" />
        </div>
      </section>

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="address">Address</label>
        <Textarea id="address" name="address" />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="planId">Membership plan</label>
          <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" id="planId" name="planId" defaultValue={plans[0]?.id ?? ""}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.planId?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="startDate">Start date</label>
          <Input id="startDate" name="startDate" type="date" defaultValue={formatDateInput(new Date())} />
          <FieldError message={state.fieldErrors?.startDate?.[0]} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="paymentStatus">Payment status</label>
          <select className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm" id="paymentStatus" name="paymentStatus" defaultValue="pending">
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially paid</option>
            <option value="waived">Waived</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="discountAmount">Discount</label>
          <Input id="discountAmount" min={0} name="discountAmount" step="0.01" type="number" defaultValue={0} />
        </div>
      </section>

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="notes">Internal notes</label>
        <Textarea id="notes" name="notes" />
      </div>

      <AuthSubmitButton>Create Member and Membership</AuthSubmitButton>
    </form>
  );
}
