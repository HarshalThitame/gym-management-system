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

/**
 * Page transition - fade and slide up
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20, filter: "blur(10px)" },
  animate: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { 
      duration: 0.5, 
      ease: [0.25, 0.46, 0.45, 0.94] 
    } 
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    filter: "blur(10px)",
    transition: { duration: 0.3 } 
  },
};

/**
 * Cinematic stagger container with blur effect
 */
export const cinematicStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
      ease: "easeOut",
    },
  },
};

/**
 * Cinematic stagger item with blur and scale
 */
export const cinematicStaggerItem: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(10px)", scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: { 
      duration: 0.5, 
      ease: [0.25, 0.46, 0.45, 0.94] 
    },
  },
};

/**
 * Scroll reveal animation - triggered by intersection observer
 */
export const scrollReveal: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

/**
 * Glow pulse animation for status indicators
 */
export const glowPulse: Variants = {
  initial: { 
    boxShadow: "0 0 0 0 rgba(99, 102, 241, 0.4)" 
  },
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(99, 102, 241, 0.4)",
      "0 0 0 10px rgba(99, 102, 241, 0)",
      "0 0 0 0 rgba(99, 102, 241, 0)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/**
 * Shimmer loading animation
 */
export const shimmer: Variants = {
  initial: { x: "-100%" },
  animate: {
    x: "100%",
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/**
 * Float animation - subtle up and down movement
 */
export const float: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-10, 10, -10],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/**
 * Success checkmark animation
 */
export const successCheck: Variants = {
  initial: { scale: 0, rotate: 45, opacity: 0 },
  animate: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.68, -0.55, 0.265, 1.55],
    },
  },
};

/**
 * Error shake animation
 */
export const errorShake: Variants = {
  initial: { x: 0 },
  animate: {
    x: [-10, 10, -10, 10, -5, 5, 0],
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

/**
 * Gradient border rotation
 */
export const gradientRotate: Variants = {
  initial: { rotate: 0 },
  animate: {
    rotate: 360,
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

/**
 * Card hover with glow effect
 */
export const cardHoverGlow: TargetAndTransition = {
  y: -8,
  boxShadow: "0 20px 60px rgba(99, 102, 241, 0.3), 0 0 40px rgba(139, 92, 246, 0.2)",
  transition: {
    duration: 0.3,
    ease: "easeOut",
  },
};

/**
 * Notification badge pulse
 */
export const notificationPulse: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};
