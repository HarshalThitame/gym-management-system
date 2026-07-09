"use server";

import {
  createOrgAutoDebitCheckoutAction,
} from "@/features/billing/services/org-subscription-autodebit-service";
import type {
  OrgAutoDebitCheckoutInput as SecureCheckoutIntentInput,
  OrgAutoDebitCheckoutResult as SecureCheckoutIntentResult,
} from "@/features/billing/services/org-subscription-autodebit-service";

export async function createSecureSubscriptionCheckoutOrderAction(
  input: SecureCheckoutIntentInput,
): Promise<SecureCheckoutIntentResult> {
  return createOrgAutoDebitCheckoutAction(input);
}

