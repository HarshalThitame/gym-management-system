"use client";

import { useState, useActionState } from "react";
import { motion } from "framer-motion";
import { Copy, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { WorkoutExerciseForm } from "@/features/training/components/training-forms";
import { cloneProgramTemplateAction } from "@/features/training/actions/trainer-self-service-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { cn } from "@/lib/utils";
import type { WorkoutProgramRow } from "@/types/training";

const difficultyColors: Record<string, string> = {
  beginner: "from-green-500 to-emerald-600",
  intermediate: "from-blue-500 to-indigo-600",
  advanced: "from-orange-500 to-red-600",
  elite: "from-purple-500 to-pink-600",
};

export function TemplateLibrary({ templates }: { templates: WorkoutProgramRow[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-premium">
        <div className="border-b border-border bg-gradient-to-r from-accent/5 to-purple-600/5 p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-accent to-purple-600 text-white shadow-glow">
              <Layers className="size-5" />
            </div>
            <div>
              <h3 className="text-2xl font-black">Template Library</h3>
              <p className="text-xs font-semibold text-muted-foreground">Browse and clone shared program templates from other trainers</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template, index) => (
            <TemplateCard key={template.id} template={template} index={index} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TemplateCard({ template, index }: { template: WorkoutProgramRow; index: number }) {
  const [state, formAction, pending] = useActionState(cloneProgramTemplateAction, initialAuthActionState);
  const [showClone, setShowClone] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 150, damping: 20 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-surface-muted/50 p-4 transition-all duration-300 hover:border-accent/30 hover:shadow-glow-sm"
    >
      <div className={cn(
        "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
        difficultyColors[template.difficulty] ?? "from-accent to-purple-600"
      )} />
      <div className="mt-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-black">{template.name}</h4>
          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            {template.difficulty}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{template.goal}</p>
        <p className="mt-2 text-xs text-muted-foreground">{template.duration_weeks} weeks</p>

        {showClone ? (
          <form action={formAction} className="mt-3 space-y-2">
            <Input name="templateId" type="hidden" value={template.id} />
            <Input
              name="newName"
              placeholder={`My ${template.name}`}
              className="text-xs"
              required
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending} className="flex-1">
                <Copy className="mr-1 size-3" />
                {pending ? "Cloning..." : "Clone"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowClone(false)}>
                Cancel
              </Button>
            </div>
            {state?.status === "success" && (
              <p className="text-xs font-bold text-success">{state.message}</p>
            )}
            {state?.status === "error" && (
              <p className="text-xs font-bold text-destructive">{state.message}</p>
            )}
          </form>
        ) : (
          <button
            onClick={() => setShowClone(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold transition-all duration-200 hover:border-accent/30 hover:bg-accent/5 hover:shadow-glow-sm"
          >
            <Copy className="size-3.5" />
            Clone Program
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function ProgramCard({ program }: { program: WorkoutProgramRow }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4 transition-all duration-200 hover:border-accent/30 hover:shadow-glow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black">{program.name}</h3>
            <TrainingStatusBadge status={program.status} />
            {program.is_template && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Template
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {program.goal} &middot; {program.difficulty} &middot; {program.duration_weeks} weeks
          </p>
          {program.description && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{program.description}</p>
          )}
        </div>
      </div>
      <div className="mt-4">
        <WorkoutExerciseForm programId={program.id} />
      </div>
    </div>
  );
}
