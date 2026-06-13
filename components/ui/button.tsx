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
        link: "h-auto rounded-none p-0 text-foreground underline-offset-4 hover:underline"
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
};

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonLinkProps = BaseProps & {
  href: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
  "aria-label"?: string;
};

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} type={type} {...props} />;
}

export function ButtonLink({ className, variant, size, href, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} href={href} {...props}>
      {children}
    </Link>
  );
}

export { buttonVariants };
