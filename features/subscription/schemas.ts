import { z } from "zod";

// Phase 4: Razorpay subscription order creation
export const verifyRazorpayPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, "Razorpay order ID is required."),
  razorpay_payment_id: z.string().min(1, "Razorpay payment ID is required."),
  razorpay_signature: z.string().min(1, "Razorpay signature is required."),
  invoiceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  packageId: z.string().uuid(),
});

export type VerifyRazorpayPaymentInput = z.infer<typeof verifyRazorpayPaymentSchema>;

export const createRazorpayOrderSchema = z.object({
  organizationId: z.string().uuid(),
  packageId: z.string().uuid(),
  billingCycle: z.enum(["monthly", "annual"]),
  subscriptionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
});

export type CreateRazorpayOrderInput = z.infer<typeof createRazorpayOrderSchema>;
