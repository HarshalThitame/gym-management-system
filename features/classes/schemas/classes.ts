import { z } from "zod";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time.");
const moneyString = z.coerce.number().min(0).max(1_000_000).transform((value) => Math.round(value * 100));

export const ClassCategorySchema = z.object({
  categoryId: optionalUuid,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  colorToken: z.string().trim().min(2).max(40),
  status: z.enum(["active", "archived"]),
  displayOrder: z.coerce.number().int().min(0).max(9999)
});

export const ClassSchema = z.object({
  classId: optionalUuid,
  categoryId: optionalUuid,
  primaryTrainerId: optionalUuid,
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(10).max(1400),
  classType: z.enum(["group_class", "workshop", "special_event", "challenge", "camp", "group_pt"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "all_levels"]),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  defaultCapacity: z.coerce.number().int().min(1).max(500),
  reservedCapacity: z.coerce.number().int().min(0).max(500),
  bookingWindowDays: z.coerce.number().int().min(0).max(365),
  cancellationWindowHours: z.coerce.number().int().min(0).max(240),
  requirements: z.string().trim().max(1000).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  membershipAccess: z.enum(["active_members", "premium_only", "staff_approval", "public_event"]),
  requiresApproval: z.coerce.boolean(),
  priceAmount: moneyString,
  status: z.enum(["draft", "active", "archived", "cancelled"])
}).refine((value) => value.reservedCapacity <= value.defaultCapacity, {
  message: "Reserved seats cannot exceed class capacity.",
  path: ["reservedCapacity"]
});

export const ClassSessionSchema = z.object({
  sessionId: optionalUuid,
  classId: z.string().uuid(),
  scheduleId: optionalUuid,
  primaryTrainerId: optionalUuid,
  substituteTrainerId: optionalUuid,
  sessionDate: z.string().min(10),
  startsAt: timeString,
  endsAt: timeString,
  capacity: z.coerce.number().int().min(1).max(500),
  reservedCapacity: z.coerce.number().int().min(0).max(500),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(1200).optional().or(z.literal(""))
}).refine((value) => value.endsAt > value.startsAt, {
  message: "End time must be after start time.",
  path: ["endsAt"]
}).refine((value) => value.reservedCapacity <= value.capacity, {
  message: "Reserved seats cannot exceed capacity.",
  path: ["reservedCapacity"]
});

export const ClassScheduleSchema = z.object({
  classId: z.string().uuid(),
  recurrence: z.enum(["one_time", "daily", "weekly", "monthly", "custom"]),
  startDate: z.string().min(10),
  endDate: z.string().optional().or(z.literal("")),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional().or(z.literal("")),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().or(z.literal("")),
  startsAt: timeString,
  endsAt: timeString,
  capacityOverride: z.coerce.number().int().min(1).max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(800).optional().or(z.literal(""))
}).refine((value) => value.endsAt > value.startsAt, {
  message: "End time must be after start time.",
  path: ["endsAt"]
});

export const BookClassSchema = z.object({
  sessionId: z.string().uuid(),
  memberId: optionalUuid
});

export const CancelClassBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500)
});

export const ClassAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  bookingId: optionalUuid,
  memberId: z.string().uuid(),
  status: z.enum(["attended", "absent", "cancelled", "late"]),
  method: z.enum(["qr", "trainer", "reception", "system"]),
  notes: z.string().trim().max(800).optional().or(z.literal(""))
});

export const ClassSessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  nextStatus: z.enum(["scheduled", "in_progress", "completed", "cancelled", "closed"]),
  reason: z.string().trim().max(500).optional().or(z.literal(""))
});

export const ClassReportSchema = z.object({
  type: z.enum(["attendance", "bookings", "no_shows", "waitlists", "trainer_sessions"]).default("bookings"),
  format: z.enum(["csv", "excel", "pdf"]).default("csv")
});

export type ClassInput = z.infer<typeof ClassSchema>;
export type ClassSessionInput = z.infer<typeof ClassSessionSchema>;
