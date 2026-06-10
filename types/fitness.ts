import type { Database } from "./database";
import type { MemberRow } from "./membership";
import type { TrainerRow, WorkoutProgramAssignmentRow, WorkoutProgramExerciseRow, WorkoutProgramRow } from "./training";

export const fitnessGoalTypes = ["weight_loss", "weight_gain", "muscle_gain", "fat_loss", "strength_increase", "endurance_improvement", "general_fitness"] as const;
export const fitnessGoalStatuses = ["active", "paused", "completed", "cancelled"] as const;
export const exerciseCategories = ["chest", "back", "shoulders", "arms", "legs", "core", "cardio", "mobility"] as const;
export const exerciseDifficulties = ["beginner", "intermediate", "advanced", "elite"] as const;
export const workoutSessionStatuses = ["planned", "in_progress", "completed", "skipped", "cancelled"] as const;
export const nutritionPlanTypes = ["weight_loss", "muscle_gain", "maintenance", "custom"] as const;
export const nutritionPlanStatuses = ["draft", "active", "paused", "completed", "archived"] as const;
export const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;
export const mealAdherenceStatuses = ["planned", "logged", "off_plan", "skipped"] as const;
export const progressPhotoViews = ["front", "side", "back"] as const;
export const milestoneTypes = ["first_workout", "workouts_completed", "weight_change", "attendance_count", "goal_completed", "streak", "custom"] as const;

export type FitnessGoalType = (typeof fitnessGoalTypes)[number];
export type ExerciseCategory = (typeof exerciseCategories)[number];
export type WorkoutSessionStatus = (typeof workoutSessionStatuses)[number];
export type NutritionPlanStatus = (typeof nutritionPlanStatuses)[number];

export type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
export type FitnessGoalRow = Database["public"]["Tables"]["fitness_goals"]["Row"];
export type WorkoutSessionRow = Database["public"]["Tables"]["workout_sessions"]["Row"];
export type ExerciseLogRow = Database["public"]["Tables"]["exercise_logs"]["Row"];
export type BodyMeasurementRow = Database["public"]["Tables"]["body_measurements"]["Row"];
export type ProgressPhotoRow = Database["public"]["Tables"]["progress_photos"]["Row"];
export type NutritionPlanRow = Database["public"]["Tables"]["nutrition_plans"]["Row"];
export type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];
export type MealEntryRow = Database["public"]["Tables"]["meal_entries"]["Row"];
export type FitnessMilestoneRow = Database["public"]["Tables"]["fitness_milestones"]["Row"];
export type FitnessNotificationEventRow = Database["public"]["Tables"]["fitness_notification_events"]["Row"];

export type FitnessProgressSummaryRow = Database["public"]["Views"]["fitness_member_progress_summary"]["Row"];
export type FitnessWeightTrendRow = Database["public"]["Views"]["fitness_weight_trends"]["Row"];
export type NutritionDailySummaryRow = Database["public"]["Views"]["nutrition_daily_summary"]["Row"];
export type WorkoutAdherenceSummaryRow = Database["public"]["Views"]["workout_adherence_summary"]["Row"];

export type WorkoutSessionWithLogs = WorkoutSessionRow & {
  logs: ExerciseLogRow[];
  program: Pick<WorkoutProgramRow, "id" | "name" | "goal" | "difficulty"> | null;
  goal: Pick<FitnessGoalRow, "id" | "title" | "goal_type" | "status"> | null;
};

export type NutritionPlanWithMeals = NutritionPlanRow & {
  meals: MealPlanRow[];
  trainer: Pick<TrainerRow, "id" | "display_name"> | null;
};

export type FitnessProgramAssignment = WorkoutProgramAssignmentRow & {
  program: WorkoutProgramRow | null;
  exercises: WorkoutProgramExerciseRow[];
  trainer: Pick<TrainerRow, "id" | "display_name"> | null;
};

export type MemberFitnessPortal = {
  member: MemberRow;
  trainer: Pick<TrainerRow, "id" | "display_name"> | null;
  goals: FitnessGoalRow[];
  activeGoal: FitnessGoalRow | null;
  programs: FitnessProgramAssignment[];
  workoutSessions: WorkoutSessionWithLogs[];
  measurements: BodyMeasurementRow[];
  progressPhotos: ProgressPhotoRow[];
  nutritionPlans: NutritionPlanWithMeals[];
  mealEntries: MealEntryRow[];
  milestones: FitnessMilestoneRow[];
  weightTrend: Array<{ date: string; weight: number | null; bodyFat: number | null; muscleMass: number | null; bmi: number | null }>;
  nutritionTrend: Array<{ date: string; calories: number; protein: number; carbs: number; fat: number; water: number }>;
  adherenceTrend: Array<{ week: string; planned: number; completed: number; skipped: number; adherenceRate: number }>;
  metrics: {
    completedWorkouts: number;
    workoutStreak: number;
    caloriesToday: number;
    waterToday: number;
    activeGoals: number;
    milestoneCount: number;
    latestWeightKg: number | null;
    weightChangeKg: number | null;
  };
};

export type TrainerFitnessMember = {
  member: MemberRow;
  summary: FitnessProgressSummaryRow | null;
  goals: FitnessGoalRow[];
  latestMeasurement: BodyMeasurementRow | null;
  activeNutritionPlan: NutritionPlanRow | null;
  lastWorkout: WorkoutSessionRow | null;
};

export type TrainerFitnessPortal = {
  trainer: TrainerRow | null;
  members: TrainerFitnessMember[];
  metrics: {
    assignedMembers: number;
    activeGoals: number;
    completedWorkouts30Days: number;
    membersMissingWorkouts: number;
  };
};

export type FitnessOperationsDashboard = {
  summaries: FitnessProgressSummaryRow[];
  metrics: {
    trackedMembers: number;
    activeGoals: number;
    completedWorkouts30Days: number;
    milestonesEarned: number;
    nutritionLogsToday: number;
  };
};
