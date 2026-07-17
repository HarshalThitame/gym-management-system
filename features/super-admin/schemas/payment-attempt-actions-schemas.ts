import { z } from "zod";

export const retryPaymentAttemptSchema = z.object({
  paymentAttemptId: z.string().uuid(),
  organizationId: z.string().uuid(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
  reason: z.string().trim().max(500).optional(),
});

export type RetryPaymentAttemptInput = z.infer<typeof retryPaymentAttemptSchema>;
