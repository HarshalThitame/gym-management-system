import { z } from "zod";

export const CreateRazorpayOrderSchema = z.object({
  paymentId: z.string().uuid()
});

export const VerifyRazorpayPaymentSchema = z.object({
  orderId: z.string().trim().min(8).max(120),
  paymentId: z.string().trim().min(8).max(120),
  signature: z.string().trim().min(20).max(300)
});

export const CreateRazorpayRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.coerce.number().int().min(1).max(10_000_000),
  reason: z.string().trim().min(3).max(500)
});
