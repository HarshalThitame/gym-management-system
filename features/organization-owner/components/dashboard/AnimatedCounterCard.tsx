"use client";

import React, { ReactNode } from "react";
import { motion } from "framer-motion";
import { useCountUp } from "@/components/motion";

export interface AnimatedCounterCardProps {
  value: number;
  label: string;
  icon?: ReactNode;
  unit?: string;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "blue" | "purple" | "pink" | "cyan" | "lime";
  animationDuration?: number;
  decimals?: number;
  className?: string;
  onClick?: () => void;
}

const colorVariants = {
  blue: {
    gradient: "from-blue-600/20 to-blue-400/10",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300",
    accent: "bg-blue-500/30",
  },
  purple: {
    gradient: "from-purple-600/20 to-purple-400/10",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-300",
    accent: "bg-purple-500/30",
  },
  pink: {
    gradient: "from-pink-600/20 to-pink-400/10",
    text: "text-pink-400",
    badge: "bg-pink-500/20 text-pink-300",
    accent: "bg-pink-500/30",
  },
  cyan: {
    gradient: "from-cyan-600/20 to-cyan-400/10",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-300",
    accent: "bg-cyan-500/30",
  },
  lime: {
    gradient: "from-lime-600/20 to-lime-400/10",
    text: "text-lime-400",
    badge: "bg-lime-500/20 text-lime-300",
    accent: "bg-lime-500/30",
  },
};

/**
 * Animated Counter Card with glassmorphic styling
 * Displays a number that counts up on mount with supporting text and icon
 */
export const AnimatedCounterCard = React.forwardRef<
  HTMLDivElement,
  AnimatedCounterCardProps
>(
  (
    {
      value,
      label,
      icon,
      unit = "",
      description,
      trend,
      color = "blue",
      animationDuration = 2,
      decimals = 0,
      className = "",
      onClick,
    },
    ref
  ) => {
    const displayCount = useCountUp({
      from: 0,
      to: value,
      duration: animationDuration,
      decimals,
    });

    const colorScheme = colorVariants[color];

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        onClick={onClick}
        className={`
          group relative overflow-hidden rounded-2xl cursor-pointer
          bg-gradient-to-br ${colorScheme.gradient}
          backdrop-blur-xl border border-white/10
          shadow-lg hover:shadow-2xl transition-all duration-300
          p-6 sm:p-8
          ${className}
        `}
      >
        {/* Animated background glow */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        />

        {/* Decorative corner accents */}
        <motion.div
          className={`absolute top-0 right-0 w-32 h-32 ${colorScheme.accent} rounded-full blur-3xl -z-10 opacity-20`}
          animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Content wrapper */}
        <div className="relative z-10 space-y-4">
          {/* Header with icon and label */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/70 mb-1">
                {label}
              </p>

              {/* Counter value with animated entrance */}
              <motion.div
                className="flex items-baseline gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <span
                  className={`text-4xl sm:text-5xl font-bold ${colorScheme.text}`}
                >
                  {Math.floor(displayCount)}
                </span>
                {unit && (
                  <span className="text-lg font-semibold text-white/60">
                    {unit}
                  </span>
                )}
              </motion.div>
            </div>

            {/* Icon container */}
            {icon && (
              <motion.div
                className={`
                  flex items-center justify-center w-14 h-14
                  rounded-xl ${colorScheme.accent}
                  text-white/80 flex-shrink-0
                `}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                {icon}
              </motion.div>
            )}
          </div>

          {/* Trend indicator */}
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className={`
                inline-flex items-center gap-1 px-3 py-1 rounded-lg
                ${colorScheme.badge} text-xs font-semibold
              `}
            >
              {trend.isPositive ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v6"
                  />
                </svg>
              )}
              <span>
                {trend.isPositive ? "+" : "-"}
                {Math.abs(trend.value)}%
              </span>
            </motion.div>
          )}

          {/* Description text */}
          {description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-sm text-white/60 line-clamp-2"
            >
              {description}
            </motion.p>
          )}
        </div>

        {/* Hover border glow effect */}
        <motion.div
          className={`
            absolute inset-0 rounded-2xl
            border border-transparent group-hover:border-white/20
            pointer-events-none transition-colors duration-300
          `}
        />
      </motion.div>
    );
  }
);

AnimatedCounterCard.displayName = "AnimatedCounterCard";
