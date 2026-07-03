"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type HeatmapData = {
  date: string;
  count: number;
}[];

function getIntensityColor(count: number): string {
  if (count === 0) return "bg-surface-muted";
  if (count === 1) return "bg-accent/30";
  if (count === 2) return "bg-accent/50";
  if (count <= 4) return "bg-accent/70";
  return "bg-accent";
}

function generateEmptyGrid(): { week: number; day: number; date: Date; count: number }[] {
  const now = new Date();
  const days: { week: number; day: number; date: Date; count: number }[] = [];
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  oneYearAgo.setDate(oneYearAgo.getDate() - (oneYearAgo.getDay()));

  for (let d = new Date(oneYearAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const weekDiff = Math.floor((d.getTime() - oneYearAgo.getTime()) / (7 * 86400000));
    const dayOfWeek = d.getDay();
    days.push({ week: weekDiff, day: dayOfWeek, date: new Date(d), count: 0 });
  }
  return days;
}

type StreakHeatmapProps = {
  visits: { check_in_at: string }[];
};

export function StreakHeatmap({ visits }: StreakHeatmapProps) {
  const visitMap = new Map<string, number>();
  visits.forEach((v) => {
    const dateKey = v.check_in_at.slice(0, 10);
    visitMap.set(dateKey, (visitMap.get(dateKey) || 0) + 1);
  });

  const grid = generateEmptyGrid();
  grid.forEach((cell) => {
    const dateKey = cell.date.toISOString().slice(0, 10);
    cell.count = visitMap.get(dateKey) || 0;
  });

  const weeks = Math.max(...grid.map((d) => d.week), 0);
  const months: string[] = [];
  const monthLabels: { label: string; week: number }[] = [];
  grid.forEach((d) => {
    const m = d.date.toLocaleString("en-US", { month: "short" });
    if (!months.includes(m)) {
      months.push(m);
      monthLabels.push({ label: m, week: d.week });
    }
  });

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (visits.length === 0) return null;

  return (
    <motion.div
      className="overflow-x-auto"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-1 ml-8 mb-1">
          {monthLabels.slice(0, -1).map((ml, i) => (
            <div
              key={i}
              className="text-[10px] font-bold text-muted-foreground"
              style={{ marginLeft: ml.week > 0 ? `${ml.week * 14}px` : "0" }}
            >
              {ml.label}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-2">
            {[1, 3, 5].map((day) => (
              <div key={day} className="h-[12px] text-[10px] font-bold text-muted-foreground leading-3">
                {dayLabels[day]}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: weeks + 1 }).map((_, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cell = grid.find((d) => d.week === weekIdx && d.day === dayIdx);
                  const count = cell?.count ?? 0;
                  const date = cell?.date;
                  const tooltip = date
                    ? `${date.toLocaleDateString("en-IN")}: ${count} visit${count !== 1 ? "s" : ""}`
                    : "";

                  return (
                    <motion.div
                      key={dayIdx}
                      className={cn("size-[12px] rounded-sm", getIntensityColor(count))}
                      title={tooltip}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + (weekIdx * 7 + dayIdx) * 0.001, duration: 0.2 }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 justify-end mt-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Less</span>
          {[0, 1, 2, 4].map((level) => (
            <div key={level} className={cn("size-[10px] rounded-sm", getIntensityColor(level))} />
          ))}
          <span className="text-[10px] font-semibold text-muted-foreground">More</span>
        </div>
      </div>
    </motion.div>
  );
}
