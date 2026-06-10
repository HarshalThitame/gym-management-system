import { z } from "zod";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export const ManualCheckInSchema = z.object({
  memberId: z.string().uuid(),
  deviceId: optionalUuid,
  notes: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const QrCheckInSchema = z.object({
  tokenValue: z.string().trim().min(16).max(240),
  deviceId: optionalUuid
});

export const CheckOutSchema = z.object({
  sessionId: optionalUuid,
  memberId: optionalUuid,
  deviceId: optionalUuid,
  notes: z.string().trim().max(1000).optional().or(z.literal(""))
}).refine((value) => Boolean(value.sessionId || value.memberId), {
  message: "Session or member is required.",
  path: ["sessionId"]
});

export const RegenerateQrSchema = z.object({
  memberId: z.string().uuid()
});

export const AccessDeviceSchema = z.object({
  deviceId: optionalUuid,
  deviceCode: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  deviceType: z.enum(["reception", "qr_scanner", "turnstile", "rfid_reader", "biometric", "face_recognition", "kiosk", "api"]),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "maintenance", "retired"])
});

export const AttendanceReportSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly", "custom", "exceptions"]).default("daily"),
  from: z.string().optional().or(z.literal("")),
  to: z.string().optional().or(z.literal(""))
});

export type ManualCheckInInput = z.infer<typeof ManualCheckInSchema>;
export type QrCheckInInput = z.infer<typeof QrCheckInSchema>;
export type CheckOutInput = z.infer<typeof CheckOutSchema>;
