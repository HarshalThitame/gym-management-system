"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { convertLeadAction } from "../actions/convert-lead-action";

const selectField = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function ConvertLeadForm({
  leadId,
  leadName,
  plans
}: {
  leadId: string;
  leadName: string;
  plans: Array<{ id: string; name: string; duration_days: number; price_amount: number }>;
}) {
  const [state, formAction] = useActionState(convertLeadAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <input name="leadId" type="hidden" value={leadId} />

      {state.success && state.status === "success" ? (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-center">
          <p className="text-lg font-black text-green-400">Lead Converted</p>
          <p className="mt-1 text-sm text-green-300">{leadName} is now an active member.</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="convert-plan">
          Membership Plan
        </label>
        <select className={selectField} id="convert-plan" name="membershipPlanId">
          <option value="">Select a plan...</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} ({plan.duration_days} days)
            </option>
          ))}
        </select>
      </div>

      <Button className="w-full" type="submit" variant="success">
        Convert to Member
      </Button>
    </form>
  );
}
