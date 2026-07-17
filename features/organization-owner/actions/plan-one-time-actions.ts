"use server";

import {
  createOrgPlanOneTimeCheckoutAction,
  finalizeOrgPlanOneTimePaymentAction,
  type OrgPlanOneTimeCheckoutInput,
  type OrgPlanOneTimeCheckoutResult,
  type OrgPlanOneTimeFinalizeInput,
  type OrgPlanOneTimeFinalizeResult,
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
