"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import type {
  AttendanceHeatmapPoint,
  ClassScorecard,
  LeadFunnelPoint,
  MembershipTrendPoint,
  RevenueTrendPoint,
  TrainerScorecard
} from "@/types/analytics";

export const RevenueTrendChart = dynamic<{ data: RevenueTrendPoint[] }>(
  () => import("./analytics-charts").then((module) => module.RevenueTrendChart),
  { loading: () => <ChartSkeleton className="h-80" />, ssr: false }
);

export const MembershipTrendChart = dynamic<{ data: MembershipTrendPoint[] }>(
  () => import("./analytics-charts").then((module) => module.MembershipTrendChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const TrainerUtilizationChart = dynamic<{ data: TrainerScorecard[] }>(
  () => import("./analytics-charts").then((module) => module.TrainerUtilizationChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const ClassUtilizationAnalyticsChart = dynamic<{ data: ClassScorecard[] }>(
  () => import("./analytics-charts").then((module) => module.ClassUtilizationAnalyticsChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const LeadFunnelChart = dynamic<{ data: LeadFunnelPoint[] }>(
  () => import("./analytics-charts").then((module) => module.LeadFunnelChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export function AttendanceHeatmap({ data }: { data: AttendanceHeatmapPoint[] }) {
  const max = Math.max(...data.map((point) => point.visits), 1);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
      {data.slice(0, 48).map((point) => {
        const intensity = Math.max(0.12, point.visits / max);

        return (
          <div
            className="rounded-md border border-border p-3"
            key={`${point.day}-${point.hour}`}
            style={{
              backgroundColor: `rgba(17,19,21,${intensity})`,
              color: intensity > 0.55 ? "#ffffff" : "#111315"
            }}
          >
            <p className="text-xs font-black uppercase">{point.day}</p>
            <p className="mt-1 text-sm font-bold">{point.hour}</p>
            <p className="mt-2 text-2xl font-black">{point.visits}</p>
          </div>
        );
      })}
    </div>
  );
}
