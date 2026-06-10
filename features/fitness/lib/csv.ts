import type { BodyMeasurementRow, FitnessGoalRow, MealEntryRow, NutritionPlanRow, WorkoutSessionRow } from "@/types/fitness";
import type { MemberRow } from "@/types/membership";
import { buildMeasurementDelta, calculateGoalProgress, calculateNutritionAdherence, calculateWorkoutAdherence, getTodaysNutrition } from "./business-rules";

export type FitnessReportType = "goal_progress" | "workout_adherence" | "measurement_changes" | "nutrition_compliance";

export type FitnessReportPayload = {
  type: FitnessReportType;
  generatedAt: string;
  rows: Array<{
    member: MemberRow;
    goals: FitnessGoalRow[];
    workouts: WorkoutSessionRow[];
    measurements: BodyMeasurementRow[];
    meals: MealEntryRow[];
    nutritionPlans: NutritionPlanRow[];
  }>;
};

export type FitnessReportTable = {
  title: string;
  generatedAt: string;
  headers: string[];
  rows: string[][];
};

export function fitnessRowsToCsv(report: FitnessReportPayload) {
  const table = getFitnessReportTable(report);
  const rows = [table.headers, ...table.rows];
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function getFitnessReportTable(report: FitnessReportPayload): FitnessReportTable {
  if (report.type === "workout_adherence") {
    return {
      title: "Workout Adherence Report",
      generatedAt: report.generatedAt,
      headers: ["member_id", "member_code", "member", "planned_workouts", "completed_workouts", "adherence_rate"],
      rows: report.rows.map((row) => {
        const completed = row.workouts.filter((workout) => workout.status === "completed").length;
        return [row.member.id, row.member.member_code, row.member.full_name, String(row.workouts.length), String(completed), `${calculateWorkoutAdherence(row.workouts)}%`];
      })
    };
  }

  if (report.type === "measurement_changes") {
    return {
      title: "Measurement Change Report",
      generatedAt: report.generatedAt,
      headers: ["member_id", "member_code", "member", "measurements", "weight_delta_kg", "body_fat_delta", "muscle_delta_kg", "waist_delta_cm"],
      rows: report.rows.map((row) => {
        const delta = buildMeasurementDelta(row.measurements);
        return [row.member.id, row.member.member_code, row.member.full_name, String(row.measurements.length), display(delta.weightKg), display(delta.bodyFatPercentage), display(delta.muscleMassKg), display(delta.waistCm)];
      })
    };
  }

  if (report.type === "nutrition_compliance") {
    return {
      title: "Nutrition Compliance Report",
      generatedAt: report.generatedAt,
      headers: ["member_id", "member_code", "member", "logged_meals", "calories", "protein_g", "water_ml", "estimated_adherence"],
      rows: report.rows.map((row) => {
        const latestDate = row.meals[0]?.entry_date ?? new Date().toISOString().slice(0, 10);
        const totals = getTodaysNutrition(row.meals, latestDate);
        const plan = row.nutritionPlans.find((item) => item.status === "active") ?? row.nutritionPlans[0] ?? null;
        return [row.member.id, row.member.member_code, row.member.full_name, String(row.meals.length), String(totals.calories), String(totals.protein), String(totals.water), `${calculateNutritionAdherence(plan, totals)}%`];
      })
    };
  }

  return {
    title: "Goal Progress Report",
    generatedAt: report.generatedAt,
    headers: ["member_id", "member_code", "member", "goals", "active_goals", "completed_goals", "average_progress"],
    rows: report.rows.map((row) => {
      const activeGoals = row.goals.filter((goal) => goal.status === "active").length;
      const completedGoals = row.goals.filter((goal) => goal.status === "completed").length;
      const averageProgress = row.goals.length > 0 ? Math.round(row.goals.reduce((total, goal) => total + calculateGoalProgress(goal), 0) / row.goals.length) : 0;
      return [row.member.id, row.member.member_code, row.member.full_name, String(row.goals.length), String(activeGoals), String(completedGoals), `${averageProgress}%`];
    })
  };
}

function display(value: number | null) {
  return value === null ? "" : String(value);
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}
