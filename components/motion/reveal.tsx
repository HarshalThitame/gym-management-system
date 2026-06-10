import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export function Reveal({ children, delay = 0, className }: RevealProps) {
  const style = delay > 0 ? ({ "--reveal-delay": `${delay}s` } as CSSProperties) : undefined;

  return <div className={cn("reveal-up", className)} style={style}>{children}</div>;
}
