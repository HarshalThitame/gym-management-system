"use client";

import { UsersRound } from "lucide-react";

type OccupancyMeterProps = {
  current: number;
  capacity: number;
  label?: string;
};

export function OccupancyMeter({ current, capacity, label = "Occupancy" }: OccupancyMeterProps) {
  const percent = capacity > 0 ? Math.min(Math.round((current / capacity) * 100), 100) : 0;
  const barColor = percent >= 90 ? "bg-destructive" : percent >= 70 ? "bg-warning" : "bg-success";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersRound className="size-5 text-muted-foreground" />
          <span className="text-sm font-bold text-muted-foreground">{label}</span>
        </div>
        <span className="text-sm font-black">
          {current} <span className="text-muted-foreground font-semibold">/ {capacity}</span>
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>{percent}% full</span>
        <span className={percent >= 90 ? "text-destructive" : percent >= 70 ? "text-warning" : "text-success"}>
          {percent >= 90 ? "Near capacity" : percent >= 70 ? "Busy" : "Available"}
        </span>
      </div>
    </div>
  );
}

type OccupancyGaugeProps = {
  current: number;
  capacity: number;
  size?: "sm" | "md" | "lg";
};

export function OccupancyGauge({ current, capacity, size = "md" }: OccupancyGaugeProps) {
  const percent = capacity > 0 ? Math.min(Math.round((current / capacity) * 100), 100) : 0;
  const radius = size === "sm" ? 36 : size === "lg" ? 72 : 54;
  const strokeWidth = size === "sm" ? 6 : size === "lg" ? 10 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 90 ? "#dc2626" : percent >= 70 ? "#f59e0b" : "#16a34a";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg className={`${size === "sm" ? "size-20" : size === "lg" ? "size-40" : "size-28"}`} viewBox="0 0 140 140">
        <circle cx="70" cy="70" fill="none" r={radius} stroke="hsl(var(--surface-muted))" strokeWidth={strokeWidth} />
        <circle
          cx="70" cy="70" fill="none" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform="rotate(-90 70 70)"
          className="transition-all duration-700 ease-out"
        />
        <text className={`${size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg"} font-black`} dominantBaseline="middle" fill="currentColor" textAnchor="middle" x="70" y="65">
          {current}
        </text>
        <text className="text-[10px] font-semibold" dominantBaseline="middle" fill="currentColor" fillOpacity="0.5" textAnchor="middle" x="70" y={size === "sm" ? 82 : size === "lg" ? 90 : 86}>
          inside
        </text>
      </svg>
      <p className="text-xs font-semibold text-muted-foreground">{percent}% of {capacity}</p>
    </div>
  );
}
