import { z } from "zod";
import { exerciseCategories, exerciseDifficulties, fitnessGoalStatuses, fitnessGoalTypes, mealAdherenceStatuses, mealTypes, milestoneTypes, nutritionPlanStatuses, nutritionPlanTypes, progressPhotoViews, workoutSessionStatuses } from "@/types/fitness";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const optionalDate = z.string().min(10).optional().or(z.literal(""));
const decimalString = z.coerce.number();
const optionalDecimal = (min: number, max: number) => z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().min(min).max(max).optional());
const optionalInteger = (min: number, max: number) => z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().int().min(min).max(max).optional());

export const ExerciseSchema = z.object({
  exerciseId: optionalUuid,
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(160).optional().or(z.literal("")),
  category: z.enum(exerciseCategories),
  primaryMuscleGroup: z.string().trim().min(2).max(100),
  secondaryMuscleGroups: z.string().trim().max(300).optional().or(z.literal("")),
  equipment: z.string().trim().min(2).max(100),
  difficulty: z.enum(exerciseDifficulties),
  instructions: z.string().trim().min(10).max(2500),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  videoUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["active", "archived"])
});

export const FitnessGoalSchema = z.object({
  goalId: optionalUuid,
  memberId: z.string().uuid(),
  trainerId: optionalUuid,
  goalType: z.enum(fitnessGoalTypes),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1200).optional().or(z.literal("")),
  targetValue: optionalDecimal(0, 100_000),
  targetUnit: z.string().trim().max(40).optional().or(z.literal("")),
  startValue: optionalDecimal(0, 100_000),
  currentValue: optionalDecimal(0, 100_000),
  startsOn: z.string().min(10),
  targetDate: optionalDate,
  status: z.enum(fitnessGoalStatuses)
}).refine((value) => !value.targetDate || value.targetDate >= value.startsOn, {
  message: "Target date must be on or after the start date.",
  path: ["targetDate"]
});

export const FitnessGoalStatusSchema = z.object({
  goalId: z.string().uuid(),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  currentValue: optionalDecimal(0, 100_000)
});

export const WorkoutSessionSchema = z.object({
  workoutSessionId: optionalUuid,
  memberId: z.string().uuid(),
  trainerId: optionalUuid,
  workoutProgramId: optionalUuid,
  workoutAssignmentId: optionalUuid,
  fitnessGoalId: optionalUuid,
  sessionDate: z.string().min(10),
  startedAt: z.string().optional().or(z.literal("")),
  completedAt: z.string().optional().or(z.literal("")),
  durationMinutes: optionalInteger(1, 480),
  status: z.enum(workoutSessionStatuses),
  workoutTitle: z.string().trim().min(2).max(160),
  source: z.enum(["manual", "assigned_program", "trainer_logged", "imported"]),
  notes: z.string().trim().max(1500).optional().or(z.literal(""))
});

export const ExerciseLogSchema = z.object({
  workoutSessionId: z.string().uuid(),
  memberId: z.string().uuid(),
  exerciseId: optionalUuid,
  exerciseName: z.string().trim().min(2).max(140),
  setNumber: z.coerce.number().int().min(1).max(100),
  targetReps: z.string().trim().max(60).optional().or(z.literal("")),
  repsCompleted: optionalInteger(0, 10_000),
  weightUsed: optionalDecimal(0, 10_000),
  weightUnit: z.enum(["kg", "lb", "bodyweight"]),
  durationSeconds: optionalInteger(0, 86_400),
  distance: optionalDecimal(0, 100_000),
  distanceUnit: z.enum(["km", "mile", "meter"]).optional().or(z.literal("")),
  perceivedEffort: optionalInteger(1, 10),
  notes: z.string().trim().max(800).optional().or(z.literal(""))
});

export const BodyMeasurementSchema = z.object({
  measurementId: optionalUuid,
  memberId: z.string().uuid(),
  recordedOn: z.string().min(10),
  weightKg: optionalDecimal(20, 350),
  heightCm: optionalDecimal(80, 260),
  bodyFatPercentage: optionalDecimal(1, 80),
  muscleMassKg: optionalDecimal(1, 200),
  chestCm: optionalDecimal(20, 250),
  waistCm: optionalDecimal(20, 250),
  hipsCm: optionalDecimal(20, 250),
  armsCm: optionalDecimal(10, 120),
  thighsCm: optionalDecimal(10, 150),
  customMeasurements: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const ProgressPhotoSchema = z.object({
  photoId: optionalUuid,
  memberId: z.string().uuid(),
  photoDate: z.string().min(10),
  viewType: z.enum(progressPhotoViews),
  storagePath: z.string().trim().max(500).optional().or(z.literal("")),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  visibility: z.enum(["member_only", "member_and_trainer", "staff"]),
  notes: z.string().trim().max(800).optional().or(z.literal(""))
});

export const NutritionPlanSchema = z.object({
  nutritionPlanId: optionalUuid,
  memberId: z.string().uuid(),
  trainerId: optionalUuid,
  name: z.string().trim().min(2).max(140),
  planType: z.enum(nutritionPlanTypes),
  description: z.string().trim().max(1200).optional().or(z.literal("")),
  targetCalories: z.coerce.number().int().min(800).max(8000),
  targetProteinG: decimalString.min(0).max(1000),
  targetCarbsG: decimalString.min(0).max(1500),
  targetFatG: decimalString.min(0).max(1000),
  waterTargetMl: z.coerce.number().int().min(0).max(12000),
  startsOn: z.string().min(10),
  endsOn: optionalDate,
  status: z.enum(nutritionPlanStatuses)
}).refine((value) => !value.endsOn || value.endsOn >= value.startsOn, {
  message: "End date must be on or after the start date.",
  path: ["endsOn"]
});

export const MealPlanSchema = z.object({
  mealPlanId: optionalUuid,
  nutritionPlanId: z.string().uuid(),
  memberId: z.string().uuid(),
  mealType: z.enum(mealTypes),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  calories: z.coerce.number().int().min(0).max(8000),
  proteinG: decimalString.min(0).max(1000),
  carbsG: decimalString.min(0).max(1500),
  fatG: decimalString.min(0).max(1000),
  displayOrder: z.coerce.number().int().min(0).max(9999)
});

export const MealEntrySchema = z.object({
  mealEntryId: optionalUuid,
  memberId: z.string().uuid(),
  nutritionPlanId: optionalUuid,
  mealPlanId: optionalUuid,
  entryDate: z.string().min(10),
  mealType: z.enum(mealTypes),
  foodName: z.string().trim().min(2).max(160),
  calories: z.coerce.number().int().min(0).max(8000),
  proteinG: decimalString.min(0).max(1000),
  carbsG: decimalString.min(0).max(1500),
  fatG: decimalString.min(0).max(1000),
  waterMl: z.coerce.number().int().min(0).max(12000),
  adherenceStatus: z.enum(mealAdherenceStatuses),
  notes: z.string().trim().max(800).optional().or(z.literal(""))
});

export const FitnessMilestoneSchema = z.object({
  milestoneId: optionalUuid,
  memberId: z.string().uuid(),
  fitnessGoalId: optionalUuid,
  milestoneType: z.enum(milestoneTypes),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  metricValue: optionalDecimal(0, 1_000_000),
  badgeKey: z.string().trim().max(80).optional().or(z.literal(""))
});

export const FitnessReportSchema = z.object({
  type: z.enum(["goal_progress", "workout_adherence", "measurement_changes", "nutrition_compliance"]).default("goal_progress"),
  format: z.enum(["csv", "excel", "pdf"]).default("csv")
});

export type ExerciseInput = z.infer<typeof ExerciseSchema>;
export type FitnessGoalInput = z.infer<typeof FitnessGoalSchema>;
export type WorkoutSessionInput = z.infer<typeof WorkoutSessionSchema>;
export type NutritionPlanInput = z.infer<typeof NutritionPlanSchema>;
