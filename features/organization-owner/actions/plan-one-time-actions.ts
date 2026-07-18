"use server";

import {
  cancelOrgPlanOneTimeCheckoutAction,
  createOrgPlanOneTimeCheckoutAction,
  getOrgPlanOneTimeCheckoutStateAction,
  finalizeOrgPlanOneTimePaymentAction,
  type OrgPlanOneTimeCheckoutInput,
  type OrgPlanOneTimeCheckoutResult,
  type OrgPlanOneTimeFinalizeInput,
  type OrgPlanOneTimeFinalizeResult,
  type OrgPlanOneTimeCheckoutState,
} from "@/features/billing/services/org-plan-one-time-payment-service";

export async function createOrgPlanOneTimeCheckoutIntentAction(
  input: OrgPlanOneTimeCheckoutInput,
): Promise<OrgPlanOneTimeCheckoutResult> {
  return createOrgPlanOneTimeCheckoutAction(input);
}

export async function finalizeOrgPlanOneTimePaymentIntentAction(
  input: OrgPlanOneTimeFinalizeInput,
): Promise<OrgPlanOneTimeFinalizeResult> {
  return finalizeOrgPlanOneTimePaymentAction(input);
}

export async function getOrgPlanOneTimeCheckoutStateIntentAction(): Promise<OrgPlanOneTimeCheckoutState> {
  return getOrgPlanOneTimeCheckoutStateAction();
}

export async function cancelOrgPlanOneTimeCheckoutIntentAction(): Promise<
  { success: true; checkoutState: OrgPlanOneTimeCheckoutState }
  | { success: false; error: string }
> {
  return cancelOrgPlanOneTimeCheckoutAction();
}
