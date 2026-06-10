import { z } from "zod";

export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120, "Name must be under 120 characters."),
  phone: z.string().trim().min(8, "Enter a valid phone number.").max(20, "Phone number is too long."),
  emergencyContactName: z.string().trim().max(120, "Emergency contact name is too long.").optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(20, "Emergency contact phone is too long.").optional().or(z.literal("")),
  avatarUrl: z.string().trim().url("Avatar must be a valid URL.").optional().or(z.literal(""))
});

export const UpdateEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.")
});
