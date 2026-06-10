"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

type ClassUtilizationPoint = { className: string; fillRate: number; booked: number; capacity: number };
type ClassBookingTrendPoint = { date: string; bookings: number; cancellations: number };

export const ClassUtilizationChart = dynamic<{ data: ClassUtilizationPoint[] }>(
  () => import("./class-charts").then((module) => module.ClassUtilizationChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const ClassBookingTrendChart = dynamic<{ data: ClassBookingTrendPoint[] }>(
  () => import("./class-charts").then((module) => module.ClassBookingTrendChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);
