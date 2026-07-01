"use client";

import { Dumbbell, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const BASIC_SUGGESTIONS = [
  { name: "Full Body Foundation", focus: "Strength", exercises: "Squat, Bench Press, Row, Overhead Press, Deadlift", difficulty: "Beginner" },
  { name: "Upper/Lower Split", focus: "Hypertrophy", exercises: "Pull-ups, Incline Press, Lunges, Leg Press, Curls", difficulty: "Intermediate" },
  { name: "Push/Pull/Legs", focus: "Volume", exercises: "Chest Fly, Lat Pulldown, Leg Extension, Tricep Pushdown, Face Pull", difficulty: "Intermediate" },
  { name: "Strength Progression", focus: "Power", exercises: "Deadlift, Squat, Bench Press, Clean & Press, Pull-ups", difficulty: "Advanced" },
  { name: "Endurance Circuit", focus: "Conditioning", exercises: "Kettlebell Swings, Box Jumps, Burpees, Rowing, Battle Ropes", difficulty: "All Levels" },
  { name: "Mobility & Recovery", focus: "Flexibility", exercises: "Hip Openers, Thoracic Extension, Band Pull-aparts, Couch Stretch, Foam Rolling", difficulty: "Beginner" },
];

export function BasicWorkoutSuggestions({ showCard = true }: { showCard?: boolean }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const shuffle = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!showCard) {
    return (
      <Button variant="outline" size="sm" className="mt-2 w-full gap-2" onClick={shuffle}>
        <RefreshCw className="size-4" />
        Refresh Basic Suggestions
      </Button>
    );
  }

  return (
    <div className="space-y-3" key={refreshKey}>
      <div className="grid gap-3">
        {BASIC_SUGGESTIONS.sort(() => Math.random() - 0.5).slice(0, 3).map((suggestion, i) => (
          <div className="rounded-md border border-border bg-surface p-3" key={i}>
            <div className="flex items-center gap-2">
              <Dumbbell className="size-4 text-muted-foreground" />
              <p className="font-black text-sm">{suggestion.name}</p>
              <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent">{suggestion.difficulty}</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
              <span className="text-foreground">{suggestion.focus}</span> &mdash; {suggestion.exercises}
            </p>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={shuffle}>
        <RefreshCw className="size-4" />
        Shuffle Suggestions
      </Button>
    </div>
  );
}
