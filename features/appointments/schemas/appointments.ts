import { z } from "zod";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const isoDateTime = z.string().min(16).max(30);

export const AppointmentSchema = z.object({
  appointmentId: optionalUuid,
  memberId: z.string().uuid("Select a member."),
  trainerId: optionalUuid,
  title: z.string().trim().min(2, "Title required.").max(200),
  type: z.enum(["consultation", "pt_session", "trial_session", "trainer_meeting", "follow_up", "general"]),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  location: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(1500).optional().or(z.literal(""))
}).refine((value) => value.endsAt > value.startsAt, {
  message: "End time must be after start time.",
  path: ["endsAt"]
});

export const CancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().trim().min(3, "Reason required.").max(500)
});

export const CompleteAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  notes: z.string().trim().max(1500).optional().or(z.literal(""))
});

export type AppointmentInput = z.infer<typeof AppointmentSchema>;
