import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary !text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-ink/90 focus-visible:outline-secondary",
        accent: "bg-accent !text-accent-foreground shadow-sm hover:-translate-y-0.5 hover:bg-[#b7e339] focus-visible:outline-accent",
        secondary: "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-muted",
        outline: "border border-white/35 bg-white/10 text-white backdrop-blur hover:bg-white/18 focus-visible:outline-accent",
        ghost: "text-foreground hover:bg-surface-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-[#b42318]",
        link: "h-auto rounded-none p-0 text-foreground underline-offset-4 hover:underline",
        cinematic: "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:scale-105 hover:shadow-2xl hover:from-blue-600 hover:to-purple-700 focus-visible:outline-purple-400",
        "outline-cinematic": "border border-purple-500/40 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 hover:border-purple-500/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] focus-visible:outline-purple-400"
      },
      size: {
        sm: "min-h-11 px-3",
        md: "h-11 px-5",
        lg: "h-13 px-6 text-base",
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
      {props.children}
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
      {children}
    </Link>
  );
}

export { buttonVariants };
