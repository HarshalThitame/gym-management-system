"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "./card";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
  status?: "good" | "watch" | "risk";
  trend?: "up" | "down" | "neutral";
  animate?: boolean;
};

const dotColors: Record<string, string> = {
  good: "bg-green-500",
  watch: "bg-amber-500",
  risk: "bg-red-500"
};

const glowColors: Record<string, string> = {
  good: "hover:shadow-[0_0_30px_rgba(34,197,94,0.3)]",
  watch: "hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]",
  risk: "hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
};

const iconGradients: Record<string, string> = {
  good: "from-green-500 to-emerald-600",
  watch: "from-amber-500 to-orange-600",
  risk: "from-red-500 to-rose-600",
  default: "from-accent to-purple-600"
};

function useCountUp(target: string, duration: number = 1000, animate: boolean = true) {
  const [displayValue, setDisplayValue] = useState(animate ? "0" : target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(target);
      return;
    }

    const numericValue = parseFloat(target.replace(/[^0-9.]/g, ""));
    if (isNaN(numericValue)) {
      setDisplayValue(target);
      return;
    }

    const startTime = Date.now();
    const prefix = target.match(/^[^0-9]*/)?.[0] ?? "";
    const suffix = target.match(/[^0-9.]*$/)?.[0] ?? "";

    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(numericValue * eased);
      
      setDisplayValue(`${prefix}${current.toLocaleString()}${suffix}`);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, duration, animate]);

  return displayValue;
}

export function StatCard({ label, value, detail, icon, status, trend, animate = true }: StatCardProps) {
  const displayValue = useCountUp(value, 1200, animate);
  const gradientKey = status ?? "default";
  const gradientClass = iconGradients[gradientKey];
  const glowClass = status ? glowColors[status] : "hover:shadow-glow";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className={`h-full gradient-border ${glowClass} transition-all duration-300 hover:scale-[1.02]`}>
        <CardContent className="p-5 md:p-6 h-full">
          <div className="flex items-start justify-between gap-4 h-full">
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <motion.p 
                className="mt-3 text-3xl font-black gradient-text counter-value"
                key={displayValue}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.3 }}
              >
                {displayValue}
              </motion.p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              {trend && (
                <div className="mt-2 flex items-center gap-1">
                  {trend === "up" && (
                    <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      Trending up
                    </span>
                  )}
                  {trend === "down" && (
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Trending down
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-start gap-3">
              {status ? (
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${dotColors[status] ?? "bg-gray-300"} animate-pulse-glow`} />
              ) : null}
              {icon ? (
                <motion.div 
                  className={`rounded-lg bg-gradient-to-br ${gradientClass} p-2.5 text-white shadow-glow-sm`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {icon}
                </motion.div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
