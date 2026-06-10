import { differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import type { BodyMeasurementRow, FitnessGoalRow, MealEntryRow, NutritionPlanRow, WorkoutSessionRow } from "@/types/fitness";

export function slugifyExerciseName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function formatFitnessLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function toOptionalNumber(value: number | string | null | undefined) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateBmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return null;
  }

  return roundTo(weightKg / ((heightCm / 100) ** 2), 2);
}

export function calculateGoalProgress(goal: Pick<FitnessGoalRow, "start_value" | "current_value" | "target_value" | "goal_type" | "status">) {
  if (goal.status === "completed") {
    return 100;
  }

  if (goal.start_value === null || goal.current_value === null || goal.target_value === null) {
    return 0;
  }

  const totalChange = Math.abs(goal.target_value - goal.start_value);
  if (totalChange === 0) {
    return goal.current_value === goal.target_value ? 100 : 0;
  }

  const progressChange = Math.abs(goal.current_value - goal.start_value);
  return clamp(Math.round((progressChange / totalChange) * 100), 0, 100);
}

export function calculateWeightChange(measurements: Pick<BodyMeasurementRow, "recorded_on" | "weight_kg">[]) {
  const weights = measurements
    .filter((measurement): measurement is Pick<BodyMeasurementRow, "recorded_on"> & { weight_kg: number } => measurement.weight_kg !== null)
    .toSorted((a, b) => a.recorded_on.localeCompare(b.recorded_on));

  if (weights.length < 2) {
    return null;
  }

  const first = weights[0];
  const latest = weights[weights.length - 1];
  if (!first || !latest) {
    return null;
  }

  return roundTo(latest.weight_kg - first.weight_kg, 2);
}

export function calculateWorkoutStreak(sessions: Pick<WorkoutSessionRow, "session_date" | "status">[], today = new Date()) {
  const completedDates = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => session.session_date)
  );
  let streak = 0;
  let cursor = parseISO(formatISO(today, { representation: "date" }));

  for (let index = 0; index < 365; index += 1) {
    const date = formatISO(cursor, { representation: "date" });
    if (!completedDates.has(date)) {
      break;
    }

    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  return streak;
}

export function calculateWorkoutAdherence(sessions: Pick<WorkoutSessionRow, "status">[]) {
  if (sessions.length === 0) {
    return 0;
  }

  const completed = sessions.filter((session) => session.status === "completed").length;
  return roundTo((completed / sessions.length) * 100, 2);
}

export function getTodaysNutrition(entries: Pick<MealEntryRow, "entry_date" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "water_ml">[], today: string) {
  return entries
    .filter((entry) => entry.entry_date === today)
    .reduce(
      (totals, entry) => ({
        calories: totals.calories + entry.calories,
        protein: roundTo(totals.protein + entry.protein_g, 2),
        carbs: roundTo(totals.carbs + entry.carbs_g, 2),
        fat: roundTo(totals.fat + entry.fat_g, 2),
        water: totals.water + entry.water_ml
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }
    );
}

export function calculateNutritionAdherence(plan: Pick<NutritionPlanRow, "target_calories" | "target_protein_g" | "target_carbs_g" | "target_fat_g"> | null, totals: { calories: number; protein: number; carbs: number; fat: number }) {
  if (!plan) {
    return 0;
  }

  const calorieScore = scoreTarget(totals.calories, plan.target_calories);
  const proteinScore = scoreTarget(totals.protein, plan.target_protein_g);
  const carbsScore = scoreTarget(totals.carbs, plan.target_carbs_g);
  const fatScore = scoreTarget(totals.fat, plan.target_fat_g);

  return roundTo((calorieScore * 0.45) + (proteinScore * 0.25) + (carbsScore * 0.15) + (fatScore * 0.15), 2);
}

export function isGoalOverdue(goal: Pick<FitnessGoalRow, "target_date" | "status">, today = new Date()) {
  if (!goal.target_date || goal.status !== "active") {
    return false;
  }

  return differenceInCalendarDays(parseISO(goal.target_date), today) < 0;
}

export function buildMeasurementDelta(measurements: Pick<BodyMeasurementRow, "recorded_on" | "weight_kg" | "body_fat_percentage" | "muscle_mass_kg" | "waist_cm">[]) {
  const sorted = measurements.toSorted((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const first = sorted[0] ?? null;
  const latest = sorted[sorted.length - 1] ?? null;

  return {
    weightKg: delta(first?.weight_kg, latest?.weight_kg),
    bodyFatPercentage: delta(first?.body_fat_percentage, latest?.body_fat_percentage),
    muscleMassKg: delta(first?.muscle_mass_kg, latest?.muscle_mass_kg),
    waistCm: delta(first?.waist_cm, latest?.waist_cm)
  };
}

function scoreTarget(actual: number, target: number) {
  if (target <= 0) {
    return 100;
  }

  const variance = Math.abs(actual - target) / target;
  return clamp(roundTo((1 - variance) * 100, 2), 0, 100);
}

function delta(first: number | null | undefined, latest: number | null | undefined) {
  if (first === null || first === undefined || latest === null || latest === undefined) {
    return null;
  }

  return roundTo(latest - first, 2);
}

function roundTo(value: number, precision: number) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
