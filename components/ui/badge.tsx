"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold transition-all duration-300", {
  variants: {
    variant: {
      neutral: "border-border bg-surface-muted text-muted-foreground hover:scale-105",
      success: "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:scale-105 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]",
      warning: "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 hover:scale-105 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]",
      error: "border-red-200 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 hover:scale-105 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
      info: "border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-800 hover:scale-105 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]",
      premium: "border-accent/60 bg-gradient-to-r from-accent to-purple-600 text-white hover:scale-105 hover:shadow-glow",
      gradient: "bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent border-transparent hover:scale-105",
      pulse: "border-purple-500/40 bg-white/5 backdrop-blur-xl text-white animate-pulse hover:scale-105",
      "success-glow": "border-green-500/40 bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:scale-105 badge-glow",
      "warning-glow": "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-xl text-amber-300 shadow-[0_0_20px_rgba(217,119,6,0.2)] hover:shadow-[0_0_30px_rgba(217,119,6,0.4)] hover:scale-105 badge-glow",
      "danger-glow": "border-red-500/40 bg-gradient-to-r from-red-500/10 to-rose-500/10 backdrop-blur-xl text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:scale-105 badge-glow",
      "cinematic": "border-accent/40 bg-gradient-to-r from-accent/10 via-purple-600/10 to-pink-500/10 backdrop-blur-xl text-white shadow-glow-sm hover:shadow-glow hover:scale-110 badge-glow",
      "status-active": "border-green-500/50 bg-green-500/10 text-green-400 animate-pulse-glow",
      "status-inactive": "border-gray-500/50 bg-gray-500/10 text-gray-400",
      /* Dark theme badge variants */
      "member-gradient": "bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 border-blue-400/30 text-blue-200 backdrop-blur-sm hover:scale-105",
      "member-success": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:scale-105",
      "member-warning": "border-amber-500/30 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:scale-105",
      "member-error": "border-red-500/30 bg-red-500/10 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.15)] hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:scale-105",
      "member-info": "border-blue-500/30 bg-blue-500/10 text-blue-300 shadow-[0_0_12px_rgba(30,136,255,0.15)] hover:shadow-[0_0_20px_rgba(30,136,255,0.25)] hover:scale-105"
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

