import type { CSSProperties, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export function Reveal({ children, delay = 0, className }: RevealProps) {
  const style = delay > 0 ? ({ "--reveal-delay": `${delay}s` } as CSSProperties) : undefined;
  return <div className={`reveal-up ${className ?? ""}`} style={style}>{children}</div>;
}
