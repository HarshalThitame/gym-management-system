"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import type { BranchPerformancePoint, TenantUsagePoint } from "@/types/enterprise";

export const BranchPerformanceChart = dynamic<{ data: BranchPerformancePoint[] }>(
  () => import("./enterprise-charts").then((module) => module.BranchPerformanceChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const TenantUsageChart = dynamic<{ data: TenantUsagePoint[] }>(
  () => import("./enterprise-charts").then((module) => module.TenantUsageChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);
