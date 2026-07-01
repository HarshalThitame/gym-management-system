import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg border transition-all duration-300",
  {
    variants: {
      variant: {
        default: "border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)]",
        glass: "glass border-border/50 shadow-premium hover:shadow-premium-lg hover-lift",
        elevated: "border-border bg-surface shadow-premium hover:shadow-premium-lg hover-lift",
        gradient: "border-transparent bg-gradient-to-br from-surface to-surface-muted shadow-premium hover:shadow-glow",
        glow: "border-accent/20 bg-surface shadow-glow-sm hover:shadow-glow hover:border-accent/40"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2 p-5 md:p-6", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 md:p-6 md:pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between p-5 md:p-6", className)} {...props} />;
}

/** Glassmorphic card with frosted glass effect */
const cinematicCardVariants = cva(
  "backdrop-blur-xl rounded-2xl border transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-white/5 border-white/20 hover:bg-white/10 hover:border-purple-500/40",
        "gradient-border": "bg-white/5 border-transparent bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10",
        glow: "bg-white/5 border-white/20 shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] hover:border-purple-500/60"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

type CinematicCardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cinematicCardVariants>;

/**
 * CinematicCard component with glassmorphic styling
 * @param variant - Design variant: default, gradient-border, or glow
 */
export function CinematicCard({ className, variant, ...props }: CinematicCardProps) {
  return <div className={cn(cinematicCardVariants({ variant }), className)} {...props} />;
}

