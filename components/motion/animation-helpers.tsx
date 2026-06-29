"use client";

import React, { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  staggerContainer,
  staggerItem,
  hoverLift,
  hoverLiftTransition,
  slideDrawer,
  gradientBorderGlow,
  gradientBorderGlowTransition,
} from "./animation-presets";

/**
 * Props for AnimatedContainer component
 */
export interface AnimatedContainerProps {
  children: ReactNode;
  stagger?: boolean;
  className?: string;
}

/**
 * Container for staggered animations
 * Automatically staggers children animations with delays
 */
export const AnimatedContainer = React.forwardRef<
  HTMLDivElement,
  AnimatedContainerProps
>(({ children, stagger = true, className = "" }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate="visible"
      variants={stagger ? staggerContainer : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
});

AnimatedContainer.displayName = "AnimatedContainer";

/**
 * Props for AnimatedItem component
 */
export interface AnimatedItemProps {
  children: ReactNode;
  index?: number;
  className?: string;
  delay?: number;
}

/**
 * Individual animated item - typically used inside AnimatedContainer
 * Applies stagger animation based on index
 */
export const AnimatedItem = React.forwardRef<
  HTMLDivElement,
  AnimatedItemProps
>(({ children, index = 0, className = "", delay = 0 }, ref) => {
  return (
    <motion.div
      ref={ref}
      variants={staggerItem}
      className={className}
      style={{
        animationDelay: `${index * 0.1 + delay}s`,
      }}
    >
      {children}
    </motion.div>
  );
});

AnimatedItem.displayName = "AnimatedItem";

/**
 * Props for AnimatedCard component
 */
export interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

/**
 * Card component with hover lift animation
 * Perfect for dashboard cards and interactive elements
 */
export const AnimatedCard = React.forwardRef<
  HTMLDivElement,
  AnimatedCardProps
>(({ children, className = "", hoverable = true, onClick }, ref) => {
  return (
    <motion.div
      ref={ref}
      whileHover={hoverable ? hoverLift : undefined}
      transition={hoverLiftTransition}
      className={`transition-all duration-300 ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
});

AnimatedCard.displayName = "AnimatedCard";

/**
 * Props for AnimatedDrawer component
 */
export interface AnimatedDrawerProps {
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
  backdrop?: boolean;
}

/**
 * Drawer component with slide-in animation
 * Automatically animates in/out based on isOpen state
 */
export const AnimatedDrawer = React.forwardRef<
  HTMLDivElement,
  AnimatedDrawerProps
>(
  (
    { children, isOpen, onClose, className = "", backdrop = true },
    ref
  ) => {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {backdrop && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
              />
            )}
            <motion.div
              ref={ref}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={slideDrawer}
              className={`fixed right-0 top-0 h-full bg-white shadow-2xl z-50 ${className}`}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

AnimatedDrawer.displayName = "AnimatedDrawer";

/**
 * Props for AnimatedBadge component
 */
export interface AnimatedBadgeProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

/**
 * Badge component with glow effect on hover
 * Perfect for status indicators and notifications
 */
export const AnimatedBadge = React.forwardRef<
  HTMLDivElement,
  AnimatedBadgeProps
>(({ children, className = "", hoverable = true }, ref) => {
  return (
    <motion.div
      ref={ref}
      whileHover={hoverable ? gradientBorderGlow : undefined}
      transition={gradientBorderGlowTransition}
      className={`transition-all duration-300 ${className}`}
    >
      {children}
    </motion.div>
  );
});

AnimatedBadge.displayName = "AnimatedBadge";

/**
 * Props for AnimatedButton component
 */
export interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

/**
 * Button component with scale animation on hover
 * Provides smooth interactive feedback
 */
export const AnimatedButton = React.forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(({ children, className = "", hoverable = true, ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      whileHover={hoverable ? { scale: 1.05 } : undefined}
      whileTap={hoverable ? { scale: 0.95 } : undefined}
      transition={{ duration: 0.2 }}
      className={`transition-all duration-300 ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
});

AnimatedButton.displayName = "AnimatedButton";

/**
 * Props for FadeInUp component
 */
export interface FadeInUpProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Simple fade-in with upward movement
 * Perfect for page entrance animations
 */
export const FadeInUp = React.forwardRef<HTMLDivElement, FadeInUpProps>(
  ({ children, className = "", delay = 0 }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }
);

FadeInUp.displayName = "FadeInUp";
