import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-lg border bg-surface text-base text-foreground shadow-sm transition-all duration-300 placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 input-animated",
  {
    variants: {
      variant: {
        default: "h-11 border-border px-3 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:shadow-glow-sm hover:border-accent/50",
        cinematic: "h-11 border-white/10 bg-white/5 backdrop-blur-xl px-4 py-2 text-white placeholder:text-white/40 focus:border-purple-500/60 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(102,126,234,0.3)] hover:border-white/20",
        glass: "h-11 glass border-border/50 px-3 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:shadow-glow hover:border-accent/50",
        gradient: "h-11 border-transparent bg-gradient-to-r from-surface to-surface-muted px-3 focus:ring-2 focus:ring-accent/30 focus:shadow-glow focus:border-accent/50",
        "member-dark": "h-11 border-white/15 bg-white/[0.03] px-4 text-white placeholder:text-slate/60 italic focus:border-blue-400/60 focus:shadow-[0_0_16px_rgba(30,136,255,0.15)] hover:border-white/25 transition-all duration-300"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

const textareaVariants = cva(
  "w-full rounded-lg border bg-surface text-base text-foreground shadow-sm transition-all duration-300 placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 input-animated",
  {
    variants: {
      variant: {
        default: "min-h-32 border-border px-3 py-3 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:shadow-glow-sm hover:border-accent/50",
        cinematic: "min-h-32 border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3 text-white placeholder:text-white/40 focus:border-purple-500/60 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(102,126,234,0.3)] hover:border-white/20",
        glass: "min-h-32 glass border-border/50 px-3 py-3 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:shadow-glow hover:border-accent/50",
        gradient: "min-h-32 border-transparent bg-gradient-to-r from-surface to-surface-muted px-3 py-3 focus:ring-2 focus:ring-accent/30 focus:shadow-glow focus:border-accent/50",
        "member-dark": "min-h-32 border-white/15 bg-white/[0.03] px-4 py-3 text-white placeholder:text-slate/60 italic focus:border-blue-400/60 focus:shadow-[0_0_16px_rgba(30,136,255,0.15)] hover:border-white/25 transition-all duration-300"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

type InputProps = InputHTMLAttributes<HTMLInputElement> & VariantProps<typeof inputVariants> & {
  error?: boolean;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & VariantProps<typeof textareaVariants> & {
  error?: boolean;
};

/**
 * Input component with optional glassmorphic styling
 * @param variant - Input style variant (default, cinematic, glass, or gradient)
 * @param error - Apply error state styling
 */
export function Input({ className, variant = "default", error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        inputVariants({ variant }),
        error && "border-red-500/60 focus:shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-shake",
        className
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}

/**
 * Textarea component with optional glassmorphic styling
 * @param variant - Textarea style variant (default, cinematic, glass, or gradient)
 * @param error - Apply error state styling
 */
export function Textarea({ className, variant = "default", error, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        textareaVariants({ variant }),
        error && "border-red-500/60 focus:shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-shake",
        className
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}
