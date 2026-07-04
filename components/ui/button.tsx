import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden btn-ripple",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-r from-primary to-ink !text-primary-foreground shadow-premium hover:-translate-y-0.5 hover:shadow-premium-lg hover:scale-105 focus-visible:outline-secondary",
        accent: "bg-gradient-to-r from-accent to-lime-400 !text-accent-foreground shadow-glow-sm hover:-translate-y-0.5 hover:shadow-glow hover:scale-105 focus-visible:outline-accent",
        secondary: "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-muted hover:scale-105 hover:shadow-premium",
        outline: "border border-white/35 bg-white/10 text-white backdrop-blur hover:bg-white/18 hover:border-white/50 hover:scale-105 focus-visible:outline-accent",
        ghost: "text-foreground hover:bg-surface-muted hover:scale-105",
        destructive: "bg-gradient-to-r from-destructive to-red-700 text-destructive-foreground hover:scale-105 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]",
        link: "h-auto rounded-none p-0 text-foreground underline-offset-4 hover:underline",
        cinematic: "bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:from-blue-600 hover:via-purple-700 hover:to-pink-600 focus-visible:outline-purple-400",
        "outline-cinematic": "border-2 border-purple-500/40 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 hover:border-purple-500/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-105 focus-visible:outline-purple-400",
        glow: "bg-gradient-to-r from-accent to-purple-600 text-white shadow-glow hover:shadow-glow-lg hover:scale-105 animate-pulse-glow",
        success: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] hover:scale-105",
        warning: "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:scale-105",
        /* Design System 3-Tier */
        "primary-gradient": "bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 text-white shadow-[0_12px_40px_rgba(30,136,255,0.2)] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(30,136,255,0.35)] hover:scale-[1.02] focus-visible:outline-purple-400",
        "secondary-gradient": "border-2 border-transparent bg-clip-padding bg-white/5 backdrop-blur-sm text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text hover:bg-white/[0.08] hover:scale-[1.02] focus-visible:outline-purple-400 relative",
        "ghost-member": "text-white/80 hover:text-white transition-colors duration-200"
      },
      size: {
        sm: "min-h-11 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-13 px-6 text-base",
        xl: "h-16 px-8 text-lg",
        icon: "size-10 p-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

type BaseProps = VariantProps<typeof buttonVariants> & {
  children: ReactNode;
  className?: string;
  loading?: boolean;
};

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonLinkProps = BaseProps & {
  href: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
  "aria-label"?: string;
};

export function Button({ className, variant, size, type = "button", loading = false, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      type={type}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      <span className="relative z-10">{props.children}</span>
    </button>
  );
}

export function ButtonLink({ className, variant, size, href, children, loading = false, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} href={href} {...props}>
      {loading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

export { buttonVariants };
