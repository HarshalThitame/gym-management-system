"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

type WeightTrendPoint = { date: string; weight: number | null; bodyFat: number | null; muscleMass: number | null; bmi: number | null };
type NutritionMacroPoint = { date: string; calories: number; protein: number; carbs: number; fat: number; water: number };
type WorkoutAdherencePoint = { week: string; planned: number; completed: number; skipped: number; adherenceRate: number };

export const WeightTrendChart = dynamic<{ data: WeightTrendPoint[] }>(
  () => import("./fitness-charts").then((module) => module.WeightTrendChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const NutritionMacroChart = dynamic<{ data: NutritionMacroPoint[] }>(
  () => import("./fitness-charts").then((module) => module.NutritionMacroChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const WorkoutAdherenceChart = dynamic<{ data: WorkoutAdherencePoint[] }>(
  () => import("./fitness-charts").then((module) => module.WorkoutAdherenceChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);
