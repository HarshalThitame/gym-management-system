import { z } from "zod";
import {
  SUBSCRIPTION_REQUEST_TYPES,
  BILLING_PERIODS,
} from "./types";

export const submitRequestSchema = z.object({
  organizationId: z.string().uuid(),
  requestType: z.enum(SUBSCRIPTION_REQUEST_TYPES),
  requestedPackageId: z.string().uuid().nullable().optional(),
  currentPackageId: z.string().uuid().nullable().optional(),
  requestedBillingPeriod: z.enum(BILLING_PERIODS).nullable().optional(),
  reason: z.string().max(1000).nullable().optional(),
  organizationNote: z.string().max(2000).nullable().optional(),
});

export type SubmitRequestInput = z.infer<typeof submitRequestSchema>;

export const approveRejectRequestSchema = z.object({
  requestId: z.string().uuid(),
  adminNote: z.string().max(2000).nullable().optional(),
  rejectionReason: z.string().max(2000).nullable().optional(),
});

export type ApproveRejectRequestInput = z.infer<typeof approveRejectRequestSchema>;

export const uploadPaymentProofSchema = z.object({
  requestId: z.string().uuid(),
  paymentProofUrl: z.string().url(),
  paymentNote: z.string().max(1000).nullable().optional(),
});

export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>;

export const cancelRequestSchema = z.object({
  requestId: z.string().uuid(),
});

export type CancelRequestInput = z.infer<typeof cancelRequestSchema>;

export const markUnderReviewSchema = z.object({
  requestId: z.string().uuid(),
});

export type MarkUnderReviewInput = z.infer<typeof markUnderReviewSchema>;
