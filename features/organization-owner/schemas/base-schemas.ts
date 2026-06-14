import { z } from "zod";

export const optionalUuid = z.string().uuid().or(z.literal("")).optional();
export const uuidRequired = z.string().uuid("Invalid ID format.");
export const reasonSchema = z.string().trim().min(3, "Reason is required for audit.").max(500).optional();

export const saveGymSchema = z.object({
  gymId: optionalUuid,
  name: z.string().trim().min(2, "Gym name is required.").max(140),
  slug: z.string().trim().max(80).optional(),
  timezone: z.string().trim().min(2).max(80).default("Asia/Kolkata"),
  currency: z.string().trim().length(3).default("INR"),
  status: z.enum(["active", "suspended", "archived"]).default("active")
});

export const statusActionSchema = z.object({
  id: uuidRequired,
  status: z.string().trim().min(1),
  reason: reasonSchema
});

export const saveBranchSchema = z.object({
  branchId: optionalUuid,
  gymId: uuidRequired,
  name: z.string().trim().min(2, "Branch name is required.").max(140),
  branchCode: z.string().trim().min(2).max(32),
  status: z.enum(["planned", "active", "maintenance", "suspended", "deactivated", "archived"]).default("active"),
  timezone: z.string().trim().min(2).max(80).default("Asia/Kolkata"),
  currency: z.string().trim().length(3).default("INR"),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(80).optional(),
  postalCode: z.string().trim().max(24).optional(),
  phone: z.string().trim().max(24).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  capacity: z.coerce.number().int().min(0).max(100000).default(0),
  reason: reasonSchema
});

export const saveStaffSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  fullName: z.string().trim().min(2, "Full name is required.").max(140),
  phone: z.string().trim().max(24).optional(),
  roleName: z.string().trim().min(1, "Role is required."),
  gymId: uuidRequired,
  branchId: optionalUuid,
  accessScope: z.enum(["single_branch", "multi_branch", "organization"]).default("single_branch"),
  reason: reasonSchema
});

export const saveMemberSchema = z.object({
  memberId: optionalUuid,
  gymId: uuidRequired,
  fullName: z.string().trim().min(2, "Full name is required.").max(140),
  email: z.string().trim().email().or(z.literal("")).optional(),
  phone: z.string().trim().min(5).max(24),
  dateOfBirth: z.string().trim().optional(),
  gender: z.string().trim().max(24).optional(),
  emergencyContact: z.string().trim().max(24).optional(),
  emergencyRelation: z.string().trim().max(40).optional(),
  address: z.string().trim().max(360).optional(),
  assignedTrainerId: optionalUuid,
  reason: reasonSchema
});

export const savePlanSchema = z.object({
  planId: optionalUuid,
  gymId: uuidRequired,
  name: z.string().trim().min(2).max(140),
  planType: z.enum(["monthly", "quarterly", "half_yearly", "annual", "custom"]),
  priceAmount: z.coerce.number().min(0),
  currency: z.string().trim().length(3).default("INR"),
  durationMonths: z.coerce.number().int().min(1).max(120).optional(),
  status: z.enum(["active", "disabled", "archived"]).default("active"),
  description: z.string().trim().max(400).optional(),
  reason: reasonSchema
});

export const saveTrainerSchema = z.object({
  trainerId: optionalUuid,
  gymId: uuidRequired,
  displayName: z.string().trim().min(2).max(140),
  email: z.string().trim().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(24).optional(),
  specialization: z.string().trim().max(200).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(70).optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  status: z.enum(["active", "on_leave", "inactive", "archived"]).default("active"),
  reason: reasonSchema
});

export const saveClassSchema = z.object({
  classId: optionalUuid,
  gymId: uuidRequired,
  classIdRef: uuidRequired,
  sessionDate: z.string().trim().min(1),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
  capacity: z.coerce.number().int().min(1).max(500).default(30),
  trainerId: optionalUuid,
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "closed"]).default("scheduled"),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(500).optional(),
  reason: reasonSchema
});

export const addDomainSchema = z.object({
  domain: z.string().trim().min(3).max(160),
  domainType: z.enum(["custom_domain", "subdomain"]).default("custom_domain"),
  routingMode: z.enum(["organization", "branch", "gym"]).default("organization"),
  reason: reasonSchema
});

export type SaveGymInput = z.infer<typeof saveGymSchema>;
export type StatusActionInput = z.infer<typeof statusActionSchema>;
export type SaveBranchInput = z.infer<typeof saveBranchSchema>;
export type SaveStaffInput = z.infer<typeof saveStaffSchema>;
export type SaveMemberInput = z.infer<typeof saveMemberSchema>;
export type SavePlanInput = z.infer<typeof savePlanSchema>;
export type SaveTrainerInput = z.infer<typeof saveTrainerSchema>;
export type SaveClassInput = z.infer<typeof saveClassSchema>;
export type AddDomainInput = z.infer<typeof addDomainSchema>;
