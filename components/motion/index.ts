// Animation Presets
export {
  fadeInUp,
  staggerContainer,
  staggerItem,
  hoverLift,
  hoverLiftTransition,
  slideDrawer,
  gradientBorderGlow,
  gradientBorderGlowTransition,
  pulseBadge,
  createCountUpVariants,
  bounceIn,
  scaleHover,
  scaleHoverTransition,
  slideInLeft,
  slideInRight,
  fade,
  rotateIn,
  flipCard,
} from "./animation-presets";

// Animation Helpers Components
export {
  AnimatedContainer,
  AnimatedItem,
  AnimatedCard,
  AnimatedDrawer,
  AnimatedBadge,
  AnimatedButton,
  FadeInUp,
} from "./animation-helpers";

export type {
  AnimatedContainerProps,
  AnimatedItemProps,
  AnimatedCardProps,
  AnimatedDrawerProps,
  AnimatedBadgeProps,
  AnimatedButtonProps,
  FadeInUpProps,
} from "./animation-helpers";

// Custom Hooks
export {
  useStaggerChildren,
  useCountUp,
  useAnimatedValue,
  useScrollAnimation,
  usePulse,
  useHoverAnimation,
  useDebounceAnimation,
} from "./useStaggerChildren";

export type {
  UseStaggerChildrenResult,
  UseCountUpOptions,
  UseAnimatedValueOptions,
  UseScrollAnimationOptions,
  UsePulseOptions,
  UseHoverAnimationOptions,
  UseDebounceAnimationOptions,
} from "./useStaggerChildren";
