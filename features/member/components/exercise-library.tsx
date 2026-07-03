"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Dumbbell, ChevronDown, ChevronUp, Clock, Play } from "lucide-react";
import type { ExerciseRow } from "@/types/fitness";
import { exerciseCategories, exerciseDifficulties } from "@/types/fitness";
import { cn } from "@/lib/utils";

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "border-green-200 bg-green-50 text-green-700",
  intermediate: "border-amber-200 bg-amber-50 text-amber-700",
  advanced: "border-red-200 bg-red-50 text-red-700",
  elite: "border-purple-200 bg-purple-50 text-purple-700"
};

const CATEGORY_LABELS: Record<string, string> = {
  chest: "Chest", back: "Back", shoulders: "Shoulders", arms: "Arms",
  legs: "Legs", core: "Core", cardio: "Cardio", mobility: "Mobility"
};

type ExerciseLibraryProps = {
  exercises: ExerciseRow[];
  compact?: boolean;
};

export function ExerciseLibrary({ exercises, compact = false }: ExerciseLibraryProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = exercises.filter((ex) => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase()) &&
        !ex.primary_muscle_group.toLowerCase().includes(search.toLowerCase()) &&
        !ex.equipment.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && ex.category !== categoryFilter) return false;
    if (difficultyFilter !== "all" && ex.difficulty !== difficultyFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-muted py-2 pl-10 pr-4 text-sm font-semibold placeholder:text-muted-foreground/60 focus:border-accent/50 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-bold text-muted-foreground focus:border-accent/50 focus:outline-none transition-colors"
          >
            <option value="all">All Categories</option>
            {exerciseCategories.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
            ))}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-bold text-muted-foreground focus:border-accent/50 focus:outline-none transition-colors"
          >
            <option value="all">All Levels</option>
            {exerciseDifficulties.map((diff) => (
              <option key={diff} value={diff} className="capitalize">{diff}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <Dumbbell className="mx-auto size-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm font-semibold text-muted-foreground">No exercises match your filters.</p>
        </div>
      ) : (
        <div className={cn("grid gap-3", compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
          <AnimatePresence mode="popLayout">
            {filtered.map((exercise, index) => (
              <motion.div
                key={exercise.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="rounded-xl border border-border bg-surface-muted p-4 card-hover"
              >
                <button
                  onClick={() => setExpandedId(expandedId === exercise.id ? null : exercise.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-sm truncate">{exercise.name}</h4>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {CATEGORY_LABELS[exercise.category] ?? exercise.category}
                        </span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize", DIFFICULTY_COLORS[exercise.difficulty] ?? "border-border bg-surface-muted")}>
                          {exercise.difficulty}
                        </span>
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {exercise.equipment}
                        </span>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedId === exercise.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="size-4 text-muted-foreground shrink-0 mt-1" />
                    </motion.div>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedId === exercise.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                          <Dumbbell className="size-3" />
                          <span>{exercise.primary_muscle_group}</span>
                          {exercise.secondary_muscle_groups.length > 0 && (
                            <span>· {exercise.secondary_muscle_groups.join(", ")}</span>
                          )}
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">{exercise.instructions}</p>
                        {exercise.video_url && (
                          <a href={exercise.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline">
                            <Play className="size-3" /> Watch video
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
