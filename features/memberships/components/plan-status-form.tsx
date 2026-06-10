"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import type { MembershipPlanRow } from "@/types/membership";
import { updatePlanStatusAction } from "../actions/membership-actions";

type PlanStatusFormProps = {
  plan: MembershipPlanRow;
};

export function PlanStatusForm({ plan }: PlanStatusFormProps) {
  const [state, formAction] = useActionState(updatePlanStatusAction, initialAuthActionState);
  const nextStatus = plan.status === "archived" ? "active" : "archived";

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <input name="planId" type="hidden" value={plan.id} />
      <input name="status" type="hidden" value={nextStatus} />
      <Button size="sm" type="submit" variant={nextStatus === "archived" ? "destructive" : "secondary"}>
        {nextStatus === "archived" ? "Archive Plan" : "Activate Plan"}
      </Button>
    </form>
  );
}
