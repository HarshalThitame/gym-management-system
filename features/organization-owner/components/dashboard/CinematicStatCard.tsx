"use client";

import React from "react";
import { motion } from "framer-motion";
import { CinematicCard } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export interface CinematicStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient?: {
    from: string;
    to: string;
  };
  accentColor?: string;
  sparklineData?: number[];
}

/**
 * Individual stat card with glassmorphic styling
 * Features: icon with gradient background, metric label, value, trend indicator,
 * gradient accent bar, and sparkline chart
 */
export const CinematicStatCard: React.FC<CinematicStatCardProps> = (
  {
    icon: Icon,
    label,
    value,
    trend,
    gradient = { from: "from-blue-500", to: "to-purple-500" },
    accentColor = "bg-purple-500",
    sparklineData = [20, 40, 30, 50, 45, 60, 55],
  }
) => {
    const trendIsPositive = trend?.isPositive ?? true;
    const trendColor = trendIsPositive ? "text-green-400" : "text-red-400";
    const trendBg = trendIsPositive ? "bg-green-500/10" : "bg-red-500/10";

    // Calculate sparkline points for SVG path
    const svgHeight = 24;
    const svgWidth = 60;
    const maxValue = Math.max(...sparklineData);
    const minValue = Math.min(...sparklineData);
    const range = maxValue - minValue || 1;

    const points = sparklineData.map((value, index) => {
      const x = (index / (sparklineData.length - 1)) * svgWidth;
      const y = svgHeight - ((value - minValue) / range) * svgHeight;
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(" L ")}`;

    return (
      <CinematicCard variant="default" className="p-6 group">
        <div className="space-y-4">
          {/* Icon with gradient background */}
          <div
            className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-300`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>

          {/* Metric label */}
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">
              {label}
            </p>

            {/* Value with trend */}
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-white">{value}</span>
              {trend && (
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg ${trendBg}`}
                >
                  <span
                    className={`text-xs font-semibold ${trendColor}`}
                  >
                    {trendIsPositive ? "↑" : "↓"} {trend.value}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sparkline chart */}
          <div className="pt-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-6"
              preserveAspectRatio="none"
            >
              {/* Gradient definition for sparkline */}
              <defs>
                <linearGradient
                  id={`sparkline-gradient-${Math.random()}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(168, 85, 247, 0.4)" />
                  <stop offset="100%" stopColor="rgba(168, 85, 247, 0.0)" />
                </linearGradient>
              </defs>

              {/* Fill area under sparkline */}
              <motion.path
                d={`${pathData} L ${svgWidth},${svgHeight} L 0,${svgHeight} Z`}
                fill={`url(#sparkline-gradient-${Math.random()})`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />

              {/* Sparkline stroke */}
              <motion.path
                d={pathData}
                fill="none"
                stroke="rgba(168, 85, 247, 0.8)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />
            </svg>
          </div>

          {/* Gradient accent bar at bottom */}
          <motion.div
            className={`h-1 rounded-full bg-gradient-to-r ${gradient} opacity-0`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{
              duration: 1.5,
              ease: "easeOut",
              delay: 0.2,
            }}
            style={{ originX: 0 }}
          />
        </div>
      </CinematicCard>
    );
  }
);


