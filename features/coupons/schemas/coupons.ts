import { z } from "zod";

export const CouponSchema = z.object({
  couponId: z.string().uuid().optional().or(z.literal("")),
  code: z.string().trim().min(3).max(50),
  name: z.string().trim().min(1).max(100),
  discountType: z.string().trim().max(50),
  valueAmount: z.coerce.number().min(0),
  minimumAmount: z.coerce.number().min(0),
  maxDiscountAmount: z.coerce.number().min(0).optional().or(z.literal("")),
  usageLimit: z.coerce.number().int().min(0).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
  status: z.string().trim().max(50).optional().or(z.literal(""))
});

export type CouponInput = z.infer<typeof CouponSchema>;
