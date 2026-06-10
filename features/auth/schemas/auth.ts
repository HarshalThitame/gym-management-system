import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[A-Z]/, "Add at least one uppercase letter.")
  .regex(/[a-z]/, "Add at least one lowercase letter.")
  .regex(/[0-9]/, "Add at least one number.");

export const SignInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional()
});

export const SignUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120, "Name must be under 120 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().min(8, "Enter a valid phone number.").max(20, "Phone number is too long."),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords must match.",
  path: ["confirmPassword"]
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.")
});

export const ResetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords must match.",
  path: ["confirmPassword"]
});

export const ChangePasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords must match.",
  path: ["confirmPassword"]
});

export const ResendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.")
});

export const RoleAssignmentSchema = z.object({
  userId: z.string().uuid("Select a valid user."),
  roleName: z.enum(["super_admin", "gym_admin", "reception_staff", "trainer", "member"]),
  gymId: z.string().uuid("Select a valid gym.").optional().or(z.literal(""))
});

export type SignInInput = z.infer<typeof SignInSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;
