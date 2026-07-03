"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type ProgressRingProps = {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label: string;
  sublabel?: string;
  showPercentage?: boolean;
};

export function ProgressRing({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  color = "#6366f1",
  bgColor = "#e4e7dd",
  label,
  sublabel,
  showPercentage = true
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(percentage), 200);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-black gradient-text"
            key={value}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {showPercentage ? `${Math.round(percentage)}%` : value}
          </motion.span>
          {sublabel && (
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
    </div>
  );
}
