"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useTransform } from "framer-motion";

/**
 * Result type for useStaggerChildren hook
 */
export interface UseStaggerChildrenResult {
  ref: React.RefObject<HTMLDivElement | null>;
  isVisible: boolean;
}

/**
 * Hook for triggering stagger animations when component enters viewport
 * Detects when component is visible and sets isVisible state to trigger animations
 *
 * @returns Object containing ref to attach to element and isVisible state
 */
export function useStaggerChildren(): UseStaggerChildrenResult {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -100px 0px",
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return { ref, isVisible };
}

/**
 * Props for useCountUp hook
 */
export interface UseCountUpOptions {
  from?: number;
  to: number;
  duration?: number;
  decimals?: number;
}

/**
 * Hook for animating number counters
 * Smoothly animates from one number to another
 *
 * @param options - Configuration object with from, to, duration, and decimals
 * @returns Current animated count value
 */
export function useCountUp({
  from = 0,
  to,
  duration = 2,
  decimals = 0,
}: UseCountUpOptions): number {
  const count = useMotionValue(from);

  const roundedCount = useTransform(count, (latest) => {
    const rounded = Math.round(latest * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return rounded;
  });

  useEffect(() => {
    const controls = animate(count, to, {
      duration,
      ease: "easeOut",
    });

    return () => {
      controls.stop();
    };
  }, [count, to, duration]);

  const [displayCount, setDisplayCount] = useState(from);

  useEffect(() => {
    const unsubscribe = roundedCount.onChange((value) => {
      setDisplayCount(value);
    });

    return () => unsubscribe();
  }, [roundedCount]);

  return displayCount;
}

/**
 * Options for useAnimatedValue hook
 */
export interface UseAnimatedValueOptions {
  initialValue?: number;
  duration?: number;
}

/**
 * Hook using useMotionValue for general animations
 * Returns motion value for inline styles and custom animations
 *
 * @param options - Configuration object
 * @returns Motion value for use in motion components
 */
export function useAnimatedValue({
  initialValue = 0,
  duration = 0.5,
}: UseAnimatedValueOptions = {}) {
  const motionValue = useMotionValue(initialValue);

  /**
   * Animate the value to a new target
   */
  const animateTo = (target: number) => {
    return animate(motionValue, target, {
      duration,
      ease: "easeOut",
    });
  };

  /**
   * Set value immediately without animation
   */
  const setValue = (value: number) => {
    motionValue.set(value);
  };

  /**
   * Get current value
   */
  const getValue = () => {
    return motionValue.get();
  };

  return {
    motionValue,
    animateTo,
    setValue,
    getValue,
  };
}

/**
 * Props for useScrollAnimation hook
 */
export interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * Hook for triggering animations when element scrolls into view
 *
 * @param options - Configuration for IntersectionObserver
 * @returns Object with ref and isInView state
 */
export function useScrollAnimation({
  threshold = 0.1,
  rootMargin = "0px",
  once = true,
}: UseScrollAnimationOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) {
            observer.unobserve(entry.target);
          }
        } else if (!once) {
          setIsInView(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, rootMargin, once]);

  return { ref, isInView };
}

/**
 * Props for usePulse hook
 */
export interface UsePulseOptions {
  scale?: number;
  duration?: number;
}

/**
 * Hook for pulse animation effect
 * Returns motion value that can be used with motion components
 *
 * @param options - Configuration for pulse effect
 * @returns Motion value for pulse animation
 */
export function usePulse({
  scale = 1.05,
  duration = 2,
}: UsePulseOptions = {}) {
  const pulseValue = useMotionValue(1);

  useEffect(() => {
    const controls = animate(pulseValue, [1, scale, 1], {
      duration,
      ease: "easeInOut",
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [pulseValue, scale, duration]);

  return pulseValue;
}

/**
 * Props for useHoverAnimation hook
 */
export interface UseHoverAnimationOptions {
  scale?: number;
  duration?: number;
}

/**
 * Hook for managing hover animation state
 * Useful for custom hover effects
 *
 * @param options - Configuration for hover effect
 * @returns Object with hover state and handlers
 */
export function useHoverAnimation({
  scale = 1.05,
  duration = 0.2,
}: UseHoverAnimationOptions = {}) {
  const scaleValue = useMotionValue(1);
  const [isHovered, setIsHovered] = useState(false);

  const handleHoverStart = () => {
    setIsHovered(true);
    animate(scaleValue, scale, { duration });
  };

  const handleHoverEnd = () => {
    setIsHovered(false);
    animate(scaleValue, 1, { duration });
  };

  return {
    scaleValue,
    isHovered,
    handleHoverStart,
    handleHoverEnd,
  };
}

/**
 * Props for useDebounceAnimation hook
 */
export interface UseDebounceAnimationOptions {
  delay?: number;
}

/**
 * Hook for debounced animations
 * Prevents animation from running too frequently
 *
 * @param callback - Function to execute
 * @param options - Configuration
 * @returns Debounced callback function
 */
export function useDebounceAnimation(
  callback: () => void,
  { delay = 300 }: UseDebounceAnimationOptions = {}
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback();
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}
