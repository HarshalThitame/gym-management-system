import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-md border bg-surface text-base text-foreground shadow-sm transition placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "h-11 border-border px-3 focus:border-secondary focus:ring-2 focus:ring-secondary/30",
        cinematic: "h-11 border-white/10 bg-white/5 backdrop-blur-xl px-4 py-2 text-white placeholder:text-white/40 focus:border-purple-500/60 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(102,126,234,0.3)]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

const textareaVariants = cva(
  "w-full rounded-md border bg-surface text-base text-foreground shadow-sm transition placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "min-h-32 border-border px-3 py-3 focus:border-secondary focus:ring-2 focus:ring-secondary/30",
        cinematic: "min-h-32 border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3 text-white placeholder:text-white/40 focus:border-purple-500/60 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(102,126,234,0.3)]"
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
 * @param variant - Input style variant (default or cinematic)
 * @param error - Apply error state styling
 */
export function Input({ className, variant = "default", error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        inputVariants({ variant }),
        error && "border-red-500/60 focus:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
        className
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}

/**
 * Textarea component with optional glassmorphic styling
 * @param variant - Textarea style variant (default or cinematic)
 * @param error - Apply error state styling
 */
export function Textarea({ className, variant = "default", error, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        textareaVariants({ variant }),
        error && "border-red-500/60 focus:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
        className
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}
