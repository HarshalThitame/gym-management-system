"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { motion } from "framer-motion";

interface DataPoint {
  [key: string]: string | number | undefined;
  name?: string;
}

interface AnimatedLineChartProps {
  data: DataPoint[];
  dataKey: string;
  xAxisKey?: string;
  strokeColor?: string;
  fillGradientId?: string;
  fillGradientFrom?: string;
  fillGradientTo?: string;
  height?: number;
  animationDuration?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  darkMode?: boolean;
  customTooltip?: React.ComponentType<TooltipProps<number, string>>;
  className?: string;
}

/**
 * Custom Tooltip Component with smooth fade-in
 */
const DefaultTooltip: React.FC<TooltipProps<number, string>> = (props) => {
  const { active, payload, label } = props as any;
  if (!active || !payload || payload.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg bg-slate-900/95 p-3 shadow-lg border border-blue-500/30 backdrop-blur-md"
    >
      <p className="text-sm font-medium text-white/90 mb-1">
        {String(label)}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-semibold text-blue-400">
          {entry.name}: {entry.value}
        </p>
      ))}
    </motion.div>
  );
};

/**
 * Animated Line Chart component with gradient fill and hover tooltips
 * Combines recharts for charting with Framer Motion for animations
 */
export const AnimatedLineChart = React.forwardRef<
  HTMLDivElement,
  AnimatedLineChartProps
>(
  (
    {
      data,
      dataKey,
      xAxisKey = "name",
      strokeColor = "#3b82f6",
      fillGradientId = "lineGradient",
      fillGradientFrom = "#3b82f6",
      fillGradientTo = "#8b5cf6",
      height = 300,
      animationDuration = 1500,
      showLegend = true,
      showGrid = true,
      darkMode = true,
      customTooltip,
      className = "",
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <motion.div
        ref={ref}
        className={`w-full ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* SVG definitions for gradients */}
        <svg width="0" height="0">
          <defs>
            <linearGradient
              id={fillGradientId}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={fillGradientFrom} stopOpacity={0.8} />
              <stop
                offset="100%"
                stopColor={fillGradientTo}
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>
        </svg>

        {/* Responsive Chart Container */}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
                vertical={false}
              />
            )}

            <XAxis
              dataKey={xAxisKey}
              stroke={darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              style={{ fontSize: "12px" }}
            />

            <YAxis
              stroke={darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              style={{ fontSize: "12px" }}
            />

            <Tooltip content={customTooltip || <DefaultTooltip />} />

            {showLegend && (
              <Legend
                wrapperStyle={{
                  paddingTop: "20px",
                  color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
                }}
              />
            )}

            {/* Animated Line with Gradient Fill */}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={strokeColor}
              strokeWidth={isHovered ? 3 : 2}
              dot={false}
              fill={`url(#${fillGradientId})`}
              animationDuration={animationDuration}
              animationEasing="ease-in-out"
              isAnimationActive={true}
              transition={{ duration: 0.2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    );
  }
);

AnimatedLineChart.displayName = "AnimatedLineChart";
