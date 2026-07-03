"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardSection({
  title,
  icon,
  children,
  delay = 0,
  variant = "default"
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  delay?: number;
  variant?: "default" | "glass" | "glow";
}) {
  const variants = {
    default: "bg-surface border-border",
    glass: "glass border-border/50 shadow-premium",
    glow: "bg-surface border-accent/20 shadow-glow-sm"
  };

  return (
    <motion.div
      className={cn("rounded-xl border p-5 md:p-6", variants[variant])}
      initial={{ opacity: 0, y: 24, filter: "blur(2px)", scale: 0.97 }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0, 0, 1] }}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

export function DashboardStatRow({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
