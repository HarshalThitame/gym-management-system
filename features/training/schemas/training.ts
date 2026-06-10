import { z } from "zod";
import { trainerSpecializations, workoutDifficulties } from "@/types/training";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const optionalEmail = z.string().trim().toLowerCase().email().optional().or(z.literal(""));
const moneyString = z.coerce.number().min(0).max(10_000_000).transform((value) => Math.round(value * 100));
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time.");

export const TrainerSchema = z.object({
  trainerId: optionalUuid,
  userId: optionalUuid,
  displayName: z.string().trim().min(2).max(120),
  email: optionalEmail,
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  headline: z.string().trim().min(2).max(160),
  bio: z.string().trim().max(1500).optional().or(z.literal("")),
  achievements: z.string().trim().max(1200).optional().or(z.literal("")),
  coachingPhilosophy: z.string().trim().max(1200).optional().or(z.literal("")),
  instagramUrl: z.string().trim().url().optional().or(z.literal("")),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  hourlyRateAmount: moneyString,
  status: z.enum(["active", "inactive", "on_leave", "archived"]),
  employmentType: z.enum(["full_time", "part_time", "contract", "consultant"]),
  joinedAt: z.string().min(10),
  publicVisible: z.coerce.boolean()
});

export const TrainerSpecializationSchema = z.object({
  trainerId: z.string().uuid(),
  specialization: z.enum(trainerSpecializations),
  proficiency: z.enum(["primary", "advanced", "specialist"])
});

export const CertificationSchema = z.object({
  trainerId: z.string().uuid(),
  certificationName: z.string().trim().min(2).max(160),
  issuingOrganization: z.string().trim().min(2).max(160),
  issueDate: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "expired", "archived"])
});

export const AvailabilitySchema = z.object({
  trainerId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: timeString,
  endsAt: timeString,
  breakStartsAt: timeString.optional().or(z.literal("")),
  breakEndsAt: timeString.optional().or(z.literal("")),
  isActive: z.coerce.boolean()
});

export const TrainerAssignmentSchema = z.object({
  trainerId: z.string().uuid(),
  memberId: z.string().uuid(),
  assignmentType: z.enum(["primary", "secondary", "personal_training"]),
  reason: z.string().trim().max(500).optional().or(z.literal(""))
});

export const EndTrainerAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  memberId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500)
});

export const PtPackageSchema = z.object({
  packageId: optionalUuid,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(800),
  sessionCount: z.coerce.number().int().min(1).max(200),
  validityDays: z.coerce.number().int().min(1).max(730),
  priceAmount: moneyString,
  status: z.enum(["draft", "active", "archived"]),
  isPublic: z.coerce.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(9999)
});

export const PtPurchaseSchema = z.object({
  memberId: z.string().uuid(),
  packageId: z.string().uuid(),
  trainerId: optionalUuid,
  startsOn: z.string().min(10),
  paymentStatus: z.enum(["pending_payment", "active"])
});

export const TrainerSessionSchema = z.object({
  sessionId: optionalUuid,
  trainerId: z.string().uuid(),
  memberId: z.string().uuid(),
  memberPtPackageId: optionalUuid,
  workoutProgramId: optionalUuid,
  sessionDate: z.string().min(10),
  startsAt: timeString,
  endsAt: timeString,
  workoutType: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(1200).optional().or(z.literal(""))
});

export const TrainerSessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  nextStatus: z.enum(["scheduled", "completed", "missed", "cancelled", "rescheduled"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  completionNotes: z.string().trim().max(1200).optional().or(z.literal(""))
});

export const WorkoutProgramSchema = z.object({
  programId: optionalUuid,
  trainerId: z.string().uuid(),
  memberId: optionalUuid,
  name: z.string().trim().min(2).max(140),
  goal: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  difficulty: z.enum(workoutDifficulties),
  durationWeeks: z.coerce.number().int().min(1).max(52),
  status: z.enum(["draft", "active", "archived"])
});

export const WorkoutExerciseSchema = z.object({
  programId: z.string().uuid(),
  dayNumber: z.coerce.number().int().min(1).max(14),
  exerciseName: z.string().trim().min(2).max(140),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  sets: z.string().trim().min(1).max(40),
  reps: z.string().trim().min(1).max(60),
  restSeconds: z.coerce.number().int().min(0).max(900).optional().or(z.literal("")),
  tempo: z.string().trim().max(40).optional().or(z.literal("")),
  instructions: z.string().trim().max(800).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).max(9999)
});

export const WorkoutAssignmentSchema = z.object({
  programId: z.string().uuid(),
  trainerId: z.string().uuid(),
  memberId: z.string().uuid(),
  startsOn: z.string().min(10),
  endsOn: z.string().optional().or(z.literal(""))
});

export const TrainerNoteSchema = z.object({
  trainerId: z.string().uuid(),
  memberId: z.string().uuid(),
  sessionId: optionalUuid,
  noteType: z.enum(["progress", "recommendation", "observation", "injury", "goal", "private"]),
  title: z.string().trim().min(2).max(140),
  body: z.string().trim().min(3).max(2000),
  visibility: z.enum(["trainer_only", "staff", "trainer_and_member"])
});

export const TrainerFeedbackSchema = z.object({
  trainerId: z.string().uuid(),
  memberId: z.string().uuid(),
  sessionId: optionalUuid,
  rating: z.coerce.number().int().min(1).max(5),
  feedback: z.string().trim().max(1000).optional().or(z.literal("")),
  isPublic: z.coerce.boolean()
});

export const StaffProfileSchema = z.object({
  staffId: optionalUuid,
  userId: optionalUuid,
  fullName: z.string().trim().min(2).max(120),
  email: optionalEmail,
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  staffRole: z.enum(["manager", "reception", "support", "admin"]),
  status: z.enum(["active", "on_leave", "suspended", "archived"]),
  employmentType: z.enum(["full_time", "part_time", "contract"]),
  joinedAt: z.string().min(10)
});

export type TrainerInput = z.infer<typeof TrainerSchema>;
export type PtPackageInput = z.infer<typeof PtPackageSchema>;
export type TrainerSessionInput = z.infer<typeof TrainerSessionSchema>;
