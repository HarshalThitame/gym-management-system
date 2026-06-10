import { describe, expect, it } from "vitest";
import { fitnessRowsToCsv, type FitnessReportPayload } from "@/features/fitness/lib/csv";
import { fitnessRowsToExcel, fitnessRowsToPdf } from "@/features/fitness/lib/report-export";
import {
  buildMeasurementDelta,
  calculateBmi,
  calculateGoalProgress,
  calculateNutritionAdherence,
  calculateWeightChange,
  calculateWorkoutAdherence,
  calculateWorkoutStreak,
  getTodaysNutrition,
  isGoalOverdue,
  slugifyExerciseName
} from "@/features/fitness/lib/business-rules";
import type { BodyMeasurementRow, FitnessGoalRow, MealEntryRow, NutritionPlanRow, WorkoutSessionRow } from "@/types/fitness";
import type { MemberRow } from "@/types/membership";

describe("fitness business rules", () => {
  it("slugifies exercise names", () => {
    expect(slugifyExerciseName("  Dumbbell Bench Press!! ")).toBe("dumbbell-bench-press");
  });

  it("calculates BMI and measurement deltas", () => {
    expect(calculateBmi(80, 180)).toBe(24.69);
    const measurements = [
      measurement({ recorded_on: "2026-06-01", weight_kg: 82, waist_cm: 92 }),
      measurement({ recorded_on: "2026-06-10", weight_kg: 79.5, waist_cm: 89 })
    ];
    expect(calculateWeightChange(measurements)).toBe(-2.5);
    expect(buildMeasurementDelta(measurements).waistCm).toBe(-3);
  });

  it("calculates directional goal progress", () => {
    const goal = goalRow({ goal_type: "weight_loss", start_value: 90, current_value: 85, target_value: 80, status: "active" });
    expect(calculateGoalProgress(goal)).toBe(50);
    expect(calculateGoalProgress({ ...goal, status: "completed" })).toBe(100);
  });

  it("calculates workout streak and adherence", () => {
    const workouts = [
      workout({ session_date: "2026-06-10", status: "completed" }),
      workout({ session_date: "2026-06-09", status: "completed" }),
      workout({ session_date: "2026-06-08", status: "skipped" })
    ];
    expect(calculateWorkoutStreak(workouts, new Date("2026-06-10T12:00:00"))).toBe(2);
    expect(calculateWorkoutAdherence(workouts)).toBe(66.67);
  });

  it("totals daily nutrition and scores adherence", () => {
    const meals = [
      meal({ entry_date: "2026-06-10", calories: 600, protein_g: 45, carbs_g: 70, fat_g: 15, water_ml: 500 }),
      meal({ entry_date: "2026-06-10", calories: 500, protein_g: 35, carbs_g: 55, fat_g: 12, water_ml: 750 })
    ];
    const totals = getTodaysNutrition(meals, "2026-06-10");
    expect(totals).toEqual({ calories: 1100, protein: 80, carbs: 125, fat: 27, water: 1250 });
    expect(calculateNutritionAdherence({ target_calories: 1100, target_protein_g: 80, target_carbs_g: 125, target_fat_g: 27 }, totals)).toBe(100);
  });

  it("detects overdue active goals only", () => {
    expect(isGoalOverdue(goalRow({ target_date: "2026-06-01", status: "active" }), new Date("2026-06-10T00:00:00"))).toBe(true);
    expect(isGoalOverdue(goalRow({ target_date: "2026-06-01", status: "completed" }), new Date("2026-06-10T00:00:00"))).toBe(false);
  });
});

describe("fitness report exports", () => {
  it("exports goal progress as csv, excel, and pdf", async () => {
    const payload: FitnessReportPayload = {
      type: "goal_progress",
      generatedAt: "2026-06-10T00:00:00.000Z",
      rows: [{
        member: member(),
        goals: [goalRow({ title: "Lose 5kg", start_value: 90, current_value: 85, target_value: 80 })],
        workouts: [workout({ status: "completed" })],
        measurements: [measurement({ weight_kg: 85 })],
        meals: [meal({ calories: 500 })],
        nutritionPlans: [nutritionPlan()]
      }]
    };

    expect(fitnessRowsToCsv(payload)).toContain("member_id,member_code,member");
    expect(fitnessRowsToExcel(payload)).toContain("<table>");
    expect((await fitnessRowsToPdf(payload)).byteLength).toBeGreaterThan(500);
  });
});

function member(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    id: "member-1",
    gym_id: "gym-1",
    user_id: "user-1",
    member_code: "APX-001",
    full_name: "Riya Shah",
    email: "riya@example.com",
    phone: "9999999999",
    gender: "female",
    date_of_birth: null,
    address: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    profile_photo_url: null,
    assigned_trainer_id: null,
    status: "active",
    joined_at: "2026-06-01",
    created_by: null,
    notes: null,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function goalRow(overrides: Partial<FitnessGoalRow> = {}): FitnessGoalRow {
  return {
    id: "goal-1",
    gym_id: "gym-1",
    member_id: "member-1",
    trainer_id: null,
    goal_type: "weight_loss",
    title: "Goal",
    description: null,
    target_value: 80,
    target_unit: "kg",
    start_value: 90,
    current_value: 85,
    starts_on: "2026-06-01",
    target_date: null,
    status: "active",
    completed_at: null,
    created_by: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function workout(overrides: Partial<WorkoutSessionRow> = {}): WorkoutSessionRow {
  return {
    id: "workout-1",
    gym_id: "gym-1",
    member_id: "member-1",
    trainer_id: null,
    workout_program_id: null,
    workout_assignment_id: null,
    fitness_goal_id: null,
    session_date: "2026-06-10",
    started_at: null,
    completed_at: null,
    duration_minutes: 60,
    status: "completed",
    workout_title: "Strength",
    source: "manual",
    notes: null,
    created_by: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

function measurement(overrides: Partial<BodyMeasurementRow> = {}): BodyMeasurementRow {
  return {
    id: "measurement-1",
    gym_id: "gym-1",
    member_id: "member-1",
    recorded_on: "2026-06-10",
    weight_kg: null,
    height_cm: null,
    bmi: null,
    body_fat_percentage: null,
    muscle_mass_kg: null,
    chest_cm: null,
    waist_cm: null,
    hips_cm: null,
    arms_cm: null,
    thighs_cm: null,
    custom_measurements: {},
    notes: null,
    recorded_by: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

function meal(overrides: Partial<MealEntryRow> = {}): MealEntryRow {
  return {
    id: "meal-1",
    gym_id: "gym-1",
    member_id: "member-1",
    nutrition_plan_id: null,
    meal_plan_id: null,
    entry_date: "2026-06-10",
    meal_type: "breakfast",
    food_name: "Protein bowl",
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    water_ml: 0,
    adherence_status: "logged",
    notes: null,
    logged_at: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

function nutritionPlan(overrides: Partial<NutritionPlanRow> = {}): NutritionPlanRow {
  return {
    id: "nutrition-1",
    gym_id: "gym-1",
    member_id: "member-1",
    trainer_id: null,
    name: "Maintenance",
    plan_type: "maintenance",
    description: null,
    target_calories: 500,
    target_protein_g: 0,
    target_carbs_g: 0,
    target_fat_g: 0,
    water_target_ml: 2500,
    starts_on: "2026-06-01",
    ends_on: null,
    status: "active",
    created_by: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}
