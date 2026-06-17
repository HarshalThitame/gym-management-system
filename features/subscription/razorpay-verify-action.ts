"use server";

import type { VerifyRazorpayPaymentInput } from "./schemas";

type VerifyResult = {
  success: false;
  error: string;
};

export async function verifySubscriptionRazorpayPaymentAction(
  _input: VerifyRazorpayPaymentInput,
): Promise<VerifyResult> {
  throw new Error(
    "Deprecated unsafe payment action. Use acknowledgeRazorpayCheckoutResultAction from features/billing/services/payment-acknowledgement instead.",
  );
}
