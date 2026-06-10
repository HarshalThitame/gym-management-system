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
      premium: "border-accent/60 bg-accent text-accent-foreground"
    }
  },
  defaultVariants: {
    variant: "neutral"
  }
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

