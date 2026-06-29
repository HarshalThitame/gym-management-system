"use client";

import React from "react";
import {
  TrendingUp,
  Users,
  Activity,
  Zap,
  DollarSign,
  Target,
} from "lucide-react";
import { CinematicMetricsGrid } from "./CinematicMetricsGrid";
import type { CinematicStatCardProps } from "./CinematicStatCard";

/**
 * Example usage of CinematicMetricsGrid component
 * Demonstrates how to structure metrics data and use the grid
 */
export function CinematicMetricsGridDemo() {
  // Sample metrics data
  const metricsData: CinematicStatCardProps[] = [
    {
      icon: DollarSign,
      label: "Total Revenue",
      value: "$48,500",
      trend: { value: 12.5, isPositive: true },
      gradient: { from: "from-blue-500", to: "to-cyan-500" },
      accentColor: "bg-blue-500",
      sparklineData: [20, 35, 30, 45, 40, 55, 50],
    },
    {
      icon: Users,
      label: "Active Members",
      value: "2,847",
      trend: { value: 8.2, isPositive: true },
      gradient: { from: "from-purple-500", to: "to-pink-500" },
      accentColor: "bg-purple-500",
      sparklineData: [25, 32, 28, 42, 38, 52, 48],
    },
    {
      icon: Activity,
      label: "Check-Ins",
      value: "15,234",
      trend: { value: 5.1, isPositive: true },
      gradient: { from: "from-green-500", to: "to-emerald-500" },
      accentColor: "bg-green-500",
      sparklineData: [18, 30, 25, 40, 35, 50, 45],
    },
    {
      icon: Target,
      label: "Conversion Rate",
      value: "24.5%",
      trend: { value: 2.3, isPositive: false },
      gradient: { from: "from-orange-500", to: "to-red-500" },
      accentColor: "bg-orange-500",
      sparklineData: [28, 26, 25, 24, 23, 22, 21],
    },
    {
      icon: TrendingUp,
      label: "Monthly Growth",
      value: "18.3%",
      trend: { value: 4.5, isPositive: true },
      gradient: { from: "from-teal-500", to: "to-cyan-500" },
      accentColor: "bg-teal-500",
      sparklineData: [10, 12, 15, 18, 19, 21, 23],
    },
    {
      icon: Zap,
      label: "Peak Usage",
      value: "2,450",
      trend: { value: 15.8, isPositive: true },
      gradient: { from: "from-yellow-500", to: "to-orange-500" },
      accentColor: "bg-yellow-500",
      sparklineData: [15, 25, 20, 35, 30, 45, 40],
    },
  ];

  return (
    <div className="space-y-8 p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Dashboard Metrics</h1>
        <p className="text-white/60">
          Real-time metrics with animated cards and sparkline charts
        </p>
      </div>

      <CinematicMetricsGrid metrics={metricsData} className="w-full" />

      {/* Additional content sections can be added here */}
      <section className="mt-12 space-y-4 rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">Component Features</h2>
        <ul className="space-y-2 text-sm text-white/70">
          <li>✓ Responsive grid layout (4 columns desktop, 2 tablet, 1 mobile)</li>
          <li>✓ Glassmorphic card design with backdrop blur</li>
          <li>✓ Animated trend indicators with color coding</li>
          <li>✓ Sparkline charts with gradient fill</li>
          <li>✓ Staggered entrance animations (0.1s between items)</li>
          <li>✓ Hover effects with scale and glow transitions</li>
          <li>✓ Gradient accent bars with fill animations</li>
          <li>✓ Full TypeScript support with type safety</li>
        </ul>
      </section>
    </div>
  );
}
