"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CinematicCard } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface BranchStatisticsCardProps {
  title: string;
  value: number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  maxValue?: number;
  showProgressBar?: boolean;
  variant?: "default" | "gradient-border" | "glow";
  animationDuration?: number;
}

export function BranchStatisticsCard({
  title,
  value,
  unit = "",
  icon,
  trend,
  maxValue,
  showProgressBar = false,
  variant = "glow",
  animationDuration = 2,
}: BranchStatisticsCardProps) {
  const [displayValue, setDisplayValue] = React.useState(0);
  const countUpRef = useRef<number>(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = 0;
    const endValue = value;

    const animate = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / animationDuration, 1);

      const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
      setDisplayValue(currentValue);
      countUpRef.current = currentValue;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [value, animationDuration]);

  const progressPercentage = maxValue ? (displayValue / maxValue) * 100 : 0;

  return (
    <CinematicCard variant={variant} className="p-6 overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between mb-4"
      >
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <motion.div
              key={displayValue}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-3xl font-bold text-foreground"
            >
              {displayValue.toLocaleString()}
              {unit && <span className="text-lg ml-1">{unit}</span>}
            </motion.div>
          </div>
        </div>

        {icon && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-2xl"
          >
            {icon}
          </motion.div>
        )}
      </motion.div>

      {/* Progress Bar */}
      {showProgressBar && maxValue && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="mb-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs text-muted-foreground">
              {Math.round(progressPercentage)}%
            </span>
          </div>

          {/* Progress Bar Background */}
          <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
            {/* Gradient Progress Fill */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{
                duration: animationDuration,
                ease: "easeOut",
              }}
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full shadow-lg shadow-purple-500/50"
            />

            {/* Shimmer effect */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.5,
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          </div>
        </motion.div>
      )}

      {/* Trend Indicator */}
      {trend && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex items-center gap-2 pt-4 border-t border-white/10"
        >
          <div
            className={`flex items-center gap-1 ${
              trend.direction === "up" ? "text-green-400" : "text-red-400"
            }`}
          >
            {trend.direction === "up" ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {trend.direction === "up" ? "+" : "-"}
              {Math.abs(trend.value)}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground">from last period</span>
        </motion.div>
      )}
    </CinematicCard>
  );
}

/**
 * Grid component for displaying multiple statistics cards
 */
interface BranchStatisticsGridProps {
  statistics: BranchStatisticsCardProps[];
  columns?: number;
}

export function BranchStatisticsGrid({
  statistics,
  columns = 4,
}: BranchStatisticsGridProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
            delayChildren: 0.05,
          },
        },
      }}
      className={`grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`}
    >
      {statistics.map((stat, index) => (
        <motion.div
          key={`${stat.title}-${index}`}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.4, ease: "easeOut" },
            },
          }}
        >
          <BranchStatisticsCard {...stat} />
        </motion.div>
      ))}
    </motion.div>
  );
}
