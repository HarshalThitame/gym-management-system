import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(80).optional(),
  phone: z.string().regex(/^[\d\s\+\-()]{8,20}$/, "Please enter a valid phone number").optional().or(z.literal("")),
  emergencyContactName: z.string().max(80).optional().or(z.literal("")),
  emergencyContactPhone: z.string().regex(/^[\d\s\+\-()]{8,20}$/, "Please enter a valid phone number").optional().or(z.literal("")),
});

export const workoutLogSchema = z.object({
  sets: z.number().min(1, "At least 1 set required").max(100),
  reps: z.number().min(1, "At least 1 rep required").max(1000),
  weight: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const mealLogSchema = z.object({
  mealType: z.enum(["Breakfast", "Lunch", "Dinner", "Snack", "Pre-Workout", "Post-Workout"]),
  calories: z.number().min(0).max(10000).optional(),
  protein: z.number().min(0).max(1000).optional(),
  carbs: z.number().min(0).max(1000).optional(),
  fat: z.number().min(0).max(1000).optional(),
  notes: z.string().max(500).optional(),
});

export const progressSchema = z.object({
  weightKg: z.number().min(20, "Weight must be at least 20kg").max(500, "Weight seems too high").optional(),
  bodyFatPercentage: z.number().min(1).max(70).optional(),
  waistCm: z.number().min(40).max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const freezeMembershipSchema = z.object({
  reason: z.string().min(10, "Please provide a reason (min 10 characters)").max(500),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please use YYYY-MM-DD format"),
  durationDays: z.number().min(7, "Minimum freeze is 7 days").max(90, "Maximum freeze is 90 days"),
});

export const referralSchema = z.object({
  friendName: z.string().min(2).max(80).optional(),
  friendEmail: z.string().email().optional(),
  friendPhone: z.string().regex(/^[\d\s\+\-()]{8,20}$/).optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type WorkoutLogFormData = z.infer<typeof workoutLogSchema>;
export type MealLogFormData = z.infer<typeof mealLogSchema>;
export type ProgressFormData = z.infer<typeof progressSchema>;
export type FreezeMembershipFormData = z.infer<typeof freezeMembershipSchema>;
