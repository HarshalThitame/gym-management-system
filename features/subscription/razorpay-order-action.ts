"use server";

import type { CreateRazorpayOrderInput } from "./schemas";

type ActionResult = {
  success: false;
  error: string;
};

export async function createSubscriptionRazorpayOrderAction(
  _input: CreateRazorpayOrderInput,
): Promise<ActionResult> {
  throw new Error(
    "Deprecated unsafe payment action. Use createSecureSubscriptionCheckoutOrderAction from features/billing/services/subscription-payment-orchestrator instead.",
  );
}
