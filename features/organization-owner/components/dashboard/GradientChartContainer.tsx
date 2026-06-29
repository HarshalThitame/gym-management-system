"use client";

import React, { ReactNode } from "react";
import { motion } from "framer-motion";

interface GradientChartContainerProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  responsive?: boolean;
}

/**
 * Wrapper component for charts with glassmorphic styling and gradient backgrounds
 * Provides consistent styling and animations for chart containers
 */
export const GradientChartContainer = React.forwardRef<
  HTMLDivElement,
  GradientChartContainerProps
>(
  (
    {
      children,
      className = "",
      title,
      subtitle,
      responsive = true,
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`
          relative overflow-hidden rounded-2xl
          bg-gradient-to-br from-blue-500/5 to-purple-500/5
          backdrop-blur-xl border border-white/10
          shadow-xl hover:shadow-2xl transition-shadow duration-300
          ${responsive ? "w-full" : ""}
          ${className}
        `}
      >
        {/* Animated gradient background glow */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.1, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Content container */}
        <div className="relative z-10 p-6 sm:p-8">
          {/* Header section */}
          {(title || subtitle) && (
            <div className="mb-6 space-y-1">
              {title && (
                <h3 className="text-lg font-semibold text-white/90 line-clamp-1">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-white/60 line-clamp-2">{subtitle}</p>
              )}
            </div>
          )}

          {/* Chart content */}
          {children}
        </div>

        {/* Decorative corner glows */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </motion.div>
    );
  }
);

GradientChartContainer.displayName = "GradientChartContainer";
