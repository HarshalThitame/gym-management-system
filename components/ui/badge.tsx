"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      neutral: "border-border bg-surface-muted text-muted-foreground",
      success: "border-green-200 bg-green-50 text-green-700",
      warning: "border-amber-200 bg-amber-50 text-amber-800",
      error: "border-red-200 bg-red-50 text-red-700",
      info: "border-cyan-200 bg-cyan-50 text-cyan-800",
      premium: "border-accent/60 bg-accent text-accent-foreground",
      gradient: "bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent border-transparent",
      pulse: "border-purple-500/40 bg-white/5 backdrop-blur-xl text-white animate-pulse",
      "success-glow": "border-green-500/40 bg-green-500/10 backdrop-blur-xl text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.2)]",
      "warning-glow": "border-amber-500/40 bg-amber-500/10 backdrop-blur-xl text-amber-300 shadow-[0_0_20px_rgba(217,119,6,0.2)]",
      "danger-glow": "border-red-500/40 bg-red-500/10 backdrop-blur-xl text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
    }
  },
  defaultVariants: {
    variant: "neutral"
  }
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

/**
 * Badge component with optional glassmorphic variants
 * @param variant - Badge style variant
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

