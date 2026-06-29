"use client";

import React from "react";
import { motion } from "framer-motion";
import { AnimatedContainer, AnimatedItem } from "@/components/motion";
import { CinematicStatCard, CinematicStatCardProps } from "./CinematicStatCard";

export interface CinematicMetricsGridProps {
  metrics: CinematicStatCardProps[];
  className?: string;
}

/**
 * Grid layout for metrics cards with staggered cascade animation
 * Features:
 * - Responsive grid (4 columns desktop, 2 tablet, 1 mobile)
 * - Staggered entrance animation (0.1s between items)
 * - Card hover effects with scale and glow
 * - Animated accent bars and sparklines
 */
export const CinematicMetricsGrid = React.forwardRef<
  HTMLDivElement,
  CinematicMetricsGridProps
>(({ metrics, className = "" }, ref) => {
  return (
    <AnimatedContainer
      ref={ref}
      stagger
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}
    >
      {metrics.map((metric, index) => (
        <motion.div
          key={`metric-${index}`}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
        >
          <AnimatedItem index={index}>
            <CinematicStatCard {...metric} />
          </AnimatedItem>
        </motion.div>
      ))}
    </AnimatedContainer>
  );
});

CinematicMetricsGrid.displayName = "CinematicMetricsGrid";
