"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

type HourlyPoint = { hour: string; visits: number };
type DailyPoint = { date: string; visits: number; uniqueMembers: number };

export const HourlyTrafficChart = dynamic<{ data: HourlyPoint[] }>(
  () => import("./attendance-charts").then((module) => module.HourlyTrafficChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const DailyAttendanceChart = dynamic<{ data: DailyPoint[] }>(
  () => import("./attendance-charts").then((module) => module.DailyAttendanceChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);
