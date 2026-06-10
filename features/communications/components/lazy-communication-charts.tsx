"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import type { CommunicationDailySummaryRow, CampaignPerformanceSummaryRow } from "@/types/communications";

export const ChannelVolumeChart = dynamic<{ data: CommunicationDailySummaryRow[] }>(
  () => import("./communication-charts").then((module) => module.ChannelVolumeChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const CampaignPerformanceChart = dynamic<{ data: CampaignPerformanceSummaryRow[] }>(
  () => import("./communication-charts").then((module) => module.CampaignPerformanceChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);
