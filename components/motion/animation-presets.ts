import { Variants, TargetAndTransition, VariantLabels } from "framer-motion";

/**
 * Animation preset for fade in with upward movement
 */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/**
 * Container for staggered animations - wrapper for multiple items
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

/**
 * Individual item animation for stagger effect
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

/**
 * Hover lift effect - raises element with shadow
 */
export const hoverLift: TargetAndTransition = {
  y: -8,
  boxShadow: "0 20px 60px rgba(102, 126, 234, 0.4)",
};

export const hoverLiftTransition = {
  duration: 0.3,
  ease: "easeOut",
} as const;

/**
 * Slide drawer animation - for sidebar/drawer components
 */
export const slideDrawer: Variants = {
  initial: { x: 400, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { x: 400, opacity: 0, transition: { duration: 0.3, ease: "easeIn" } },
};

/**
 * Gradient border glow effect - for hover states
 */
export const gradientBorderGlow: TargetAndTransition = {
  boxShadow: "0 0 40px rgba(102, 126, 234, 0.4)",
};

export const gradientBorderGlowTransition = {
  duration: 0.3,
  ease: "easeOut",
} as const;

/**
 * Pulse effect - continuous scaling animation
 */
export const pulseBadge: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: 1.05,
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
    },
  },
};

/**
 * Generate count-up animation variants
 * Animates a number from 'from' to 'to' value
 */
export function createCountUpVariants(
  from: number,
  to: number,
  duration: number = 2
) {
  return {
    initial: { count: from },
    animate: { count: to, transition: { duration, ease: "easeOut" as const } },
  };
}

/**
 * Bounce in animation
 */
export const bounceIn: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.5, ease: "backOut" },
  },
  exit: { scale: 0, opacity: 0, transition: { duration: 0.3 } },
};

/**
 * Scale hover effect
 */
export const scaleHover: TargetAndTransition = {
  scale: 1.05,
};

export const scaleHoverTransition = {
  duration: 0.2,
  ease: "easeOut",
} as const;

/**
 * Slide in from left
 */
export const slideInLeft: Variants = {
  initial: { x: -50, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4 } },
  exit: { x: -50, opacity: 0, transition: { duration: 0.3 } },
};

/**
 * Slide in from right
 */
export const slideInRight: Variants = {
  initial: { x: 50, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4 } },
  exit: { x: 50, opacity: 0, transition: { duration: 0.3 } },
};

/**
 * Fade animation
 */
export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

/**
 * Rotate effect
 */
export const rotateIn: Variants = {
  initial: { opacity: 0, rotate: -10 },
  animate: { opacity: 1, rotate: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, rotate: -10, transition: { duration: 0.3 } },
};

/**
 * Flip effect
 */
export const flipCard: Variants = {
  initial: { rotateY: 90, opacity: 0 },
  animate: { rotateY: 0, opacity: 1, transition: { duration: 0.5 } },
  exit: { rotateY: -90, opacity: 0, transition: { duration: 0.4 } },
};
