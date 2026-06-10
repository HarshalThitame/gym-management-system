import { z } from "zod";
import { accessLevels, documentTypes, membershipPlanTypes } from "@/types/membership";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const optionalEmail = z.string().trim().toLowerCase().email().optional().or(z.literal(""));
const moneyString = z.coerce.number().min(0).max(10_000_000).transform((value) => Math.round(value * 100));

export const MembershipPlanSchema = z.object({
  planId: optionalUuid,
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(800),
  planType: z.enum(membershipPlanTypes),
  durationDays: z.coerce.number().int().min(1).max(1095),
  priceAmount: moneyString,
  joiningFeeAmount: moneyString,
  accessLevel: z.enum(accessLevels),
  status: z.enum(["draft", "active", "archived"]),
  isPublic: z.coerce.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(9999)
});

export const MemberOnboardingSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: optionalEmail,
  phone: z.string().trim().min(8).max(20),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(120).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  assignedTrainerId: optionalUuid,
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  planId: z.string().uuid(),
  startDate: z.string().min(10),
  paymentStatus: z.enum(["pending", "paid", "partially_paid", "waived"]),
  discountAmount: moneyString
});

export const MembershipAssignmentSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: z.string().min(10),
  paymentStatus: z.enum(["pending", "paid", "partially_paid", "waived"]),
  discountAmount: moneyString,
  notes: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const RenewalSchema = z.object({
  membershipId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: z.string().min(10),
  paymentStatus: z.enum(["pending", "paid", "partially_paid", "waived"]),
  discountAmount: moneyString,
  notes: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const StatusChangeSchema = z.object({
  membershipId: z.string().uuid(),
  nextStatus: z.enum(["active", "expired", "cancelled", "frozen", "suspended"]),
  reason: z.string().trim().min(3).max(500)
});

export const PlanChangeSchema = z.object({
  membershipId: z.string().uuid(),
  planId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500)
});

export const DocumentUploadSchema = z.object({
  memberId: z.string().uuid(),
  documentType: z.enum(documentTypes)
});

export type MembershipPlanInput = z.infer<typeof MembershipPlanSchema>;
export type MemberOnboardingInput = z.infer<typeof MemberOnboardingSchema>;
