"use client";

import React, { ReactNode } from "react";
import { motion } from "framer-motion";
import { FadeInUp, AnimatedButton } from "@/components/motion/animation-helpers";
import { fadeInUp, staggerContainer, staggerItem } from "@/components/motion/animation-presets";

/**
 * Props for DashboardHeroSection component
 */
export interface DashboardHeroSectionProps {
  title: string;
  subtitle: string;
  ctaButtons?: Array<{
    label: string;
    onClick?: () => void;
    variant?: "primary" | "secondary";
  }>;
  backgroundPattern?: "dots" | "lines" | "none";
  className?: string;
}

/**
 * DashboardHeroSection Component
 *
 * A cinematic hero section for dashboard pages with:
 * - Animated gradient title
 * - Staggered subtitle with fade-in
 * - Cascade-animated CTA buttons with glow effects
 * - Optional animated background patterns
 * - Full-width responsive design
 *
 * Animations:
 * - Title: Fade-in + slide-up (0.5s)
 * - Subtitle: Fade-in delayed (0.7s)
 * - Buttons: Cascade entrance (0.1s stagger starting at 0.9s)
 */
const DashboardHeroSection = React.forwardRef<
  HTMLDivElement,
  DashboardHeroSectionProps
>(
  (
    {
      title,
      subtitle,
      ctaButtons = [],
      backgroundPattern = "dots",
      className = "",
    },
    ref
  ) => {
    return (
      <div ref={ref} className={`relative w-full overflow-hidden ${className}`}>
        {/* Animated Background Pattern */}
        {backgroundPattern === "dots" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(139, 92, 246, 0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        )}

        {/* Gradient Overlay Lines */}
        {backgroundPattern === "lines" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%)`,
              backgroundSize: "200% 100%",
            }}
          />
        )}

        {/* Glassmorphic Card Container */}
        <div className="relative z-10 py-16 md:py-24 lg:py-32 px-6 md:px-12">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-4xl mx-auto"
          >
            {/* Title with Gradient */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: "easeOut" },
                },
              }}
              className="mb-6 md:mb-8"
            >
              <h1
                className={`
                  text-4xl md:text-5xl lg:text-6xl font-bold
                  bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500
                  bg-clip-text text-transparent
                  leading-tight text-balance
                `}
              >
                {title}
              </h1>
            </motion.div>

            {/* Subtitle with Delayed Fade-In */}
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { duration: 0.5, delay: 0.2, ease: "easeOut" },
                },
              }}
              className="mb-10 md:mb-12"
            >
              <p
                className={`
                  text-lg md:text-xl text-gray-300
                  max-w-2xl leading-relaxed text-balance
                `}
              >
                {subtitle}
              </p>
            </motion.div>

            {/* CTA Buttons with Cascade Animation */}
            {ctaButtons.length > 0 && (
              <motion.div
                className="flex flex-wrap gap-4 md:gap-6 items-center"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.4,
                    },
                  },
                }}
              >
                {ctaButtons.map((button, index) => (
                  <motion.div
                    key={index}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: 0.4,
                          ease: "easeOut",
                        },
                      },
                    }}
                  >
                    <AnimatedButton
                      onClick={button.onClick}
                      className={`
                        px-8 md:px-10 py-3 md:py-4
                        rounded-lg font-semibold text-base md:text-lg
                        transition-all duration-300
                        ${
                          button.variant === "secondary"
                            ? `
                              bg-transparent border-2 border-purple-500
                              text-purple-300 hover:text-white
                              hover:border-pink-500 hover:shadow-lg
                              hover:shadow-pink-500/30
                            `
                            : `
                              bg-gradient-to-r from-blue-500 to-purple-600
                              text-white hover:shadow-xl
                              hover:shadow-purple-500/50
                            `
                        }
                      `}
                      hoverable={true}
                    >
                      {button.label}
                    </AnimatedButton>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Decorative Blur Elements */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      </div>
    );
  }
);

DashboardHeroSection.displayName = "DashboardHeroSection";

export default DashboardHeroSection;
