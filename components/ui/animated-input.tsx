"use client";

import { motion, useReducedMotion } from "framer-motion";
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AnimatedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <motion.div
        className="space-y-1.5"
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26, mass: 0.6 }}
      >
        {label ? (
          <label htmlFor={id} className="block text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </label>
        ) : null}
        <input
          id={id}
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 transition-colors duration-200",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
            error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error ? (
          <motion.p
            className="text-xs font-semibold text-red-500"
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            {error}
          </motion.p>
        ) : null}
      </motion.div>
    );
  }
);
AnimatedInput.displayName = "AnimatedInput";

interface AnimatedTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const AnimatedTextarea = forwardRef<HTMLTextAreaElement, AnimatedTextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <motion.div
        className="space-y-1.5"
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26, mass: 0.6 }}
      >
        {label ? (
          <label htmlFor={id} className="block text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </label>
        ) : null}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 transition-colors duration-200",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
            error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error ? (
          <motion.p
            className="text-xs font-semibold text-red-500"
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            {error}
          </motion.p>
        ) : null}
      </motion.div>
    );
  }
);
AnimatedTextarea.displayName = "AnimatedTextarea";

export function AnimatedSelect({
  className,
  label,
  error,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="space-y-1.5"
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, mass: 0.6 }}
    >
      {label ? (
        <label htmlFor={id} className="block text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        className={cn(
          "flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors duration-200",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
          error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <motion.p
          className="text-xs font-semibold text-red-500"
          initial={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          {error}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
