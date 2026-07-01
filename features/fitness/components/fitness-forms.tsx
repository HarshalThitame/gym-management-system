"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { ExerciseRow, FitnessGoalRow, NutritionPlanWithMeals, WorkoutSessionWithLogs } from "@/types/fitness";
import type { WorkoutProgramAssignmentRow } from "@/types/training";
import {
  addExerciseLogAction,
  deleteExerciseAction,
  saveBodyMeasurementAction,
  saveExerciseAction,
  saveFitnessGoalAction,
  saveFitnessMilestoneAction,
  saveMealEntryAction,
  saveMealPlanAction,
  saveNutritionPlanAction,
  saveProgressPhotoAction,
  saveWorkoutSessionAction,
  updateFitnessGoalStatusAction
} from "../actions/fitness-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function ExerciseForm() {
  const [state, formAction] = useActionState(saveExerciseAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <Field id="exercise-name" label="Exercise Name" name="name" state={state}><Input id="exercise-name" name="name" placeholder="Cable Row" /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Select name="category" label="Category" defaultValue="back">
          <option value="chest">Chest</option><option value="back">Back</option><option value="shoulders">Shoulders</option><option value="arms">Arms</option><option value="legs">Legs</option><option value="core">Core</option><option value="cardio">Cardio</option><option value="mobility">Mobility</option>
        </Select>
        <Select name="difficulty" label="Difficulty" defaultValue="beginner">
          <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="elite">Elite</option>
        </Select>
        <Field id="exercise-equipment" label="Equipment" name="equipment" state={state}><Input id="exercise-equipment" name="equipment" defaultValue="bodyweight" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="exercise-primary-muscle" label="Primary Muscle" name="primaryMuscleGroup" state={state}><Input id="exercise-primary-muscle" name="primaryMuscleGroup" placeholder="Lats" /></Field>
        <Field id="exercise-secondary-muscles" label="Secondary Muscles" name="secondaryMuscleGroups" state={state}><Input id="exercise-secondary-muscles" name="secondaryMuscleGroups" placeholder="Biceps, rear delts" /></Field>
      </div>
      <Field id="exercise-instructions" label="Instructions" name="instructions" state={state}><Textarea id="exercise-instructions" name="instructions" placeholder="Setup, execution, safety cues, and coaching notes." /></Field>
      <AuthSubmitButton>Save Exercise</AuthSubmitButton>
    </form>
  );
}

export function FitnessGoalForm({ memberId, trainerId = "", goals = [] }: { memberId: string; trainerId?: string; goals?: FitnessGoalRow[] }) {
  const [state, formAction] = useActionState(saveFitnessGoalAction, initialAuthActionState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <HiddenInput name="trainerId" value={trainerId} />
      <Field id={`goal-title-${memberId}`} label="Goal Title" name="title" state={state}><Input id={`goal-title-${memberId}`} name="title" placeholder="Lose 5kg while maintaining strength" /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Select name="goalType" label="Goal type" defaultValue="general_fitness">
          <option value="weight_loss">Weight Loss</option><option value="weight_gain">Weight Gain</option><option value="muscle_gain">Muscle Gain</option><option value="fat_loss">Fat Loss</option><option value="strength_increase">Strength Increase</option><option value="endurance_improvement">Endurance</option><option value="general_fitness">General Fitness</option>
        </Select>
        <Select name="status" label="Status" defaultValue="active">
          <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </Select>
        <Field id={`goal-unit-${memberId}`} label="Target Unit" name="targetUnit" state={state}><Input id={`goal-unit-${memberId}`} name="targetUnit" placeholder="kg, %, reps" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Input name="startValue" placeholder="Start value" type="number" step="0.01" />
        <Input name="currentValue" placeholder="Current value" type="number" step="0.01" />
        <Input name="targetValue" placeholder="Target value" type="number" step="0.01" />
        <Input name="startsOn" type="date" defaultValue={today} />
      </div>
      <Input name="targetDate" type="date" aria-label="Target date" />
      <Textarea name="description" placeholder="Why this goal matters and how progress will be measured." />
      <AuthSubmitButton>{goals.length > 0 ? "Save Goal" : "Create Goal"}</AuthSubmitButton>
    </form>
  );
}

export function GoalStatusForm({ goal }: { goal: FitnessGoalRow }) {
  const [state, formAction] = useActionState(updateFitnessGoalStatusAction, initialAuthActionState);
  return (
    <form action={formAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
      <FormMessage state={state} />
      <HiddenInput name="goalId" value={goal.id} />
      <select className={selectClass} name="status" defaultValue={goal.status} aria-label="Goal status">
        <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
      </select>
      <Input name="currentValue" placeholder="Current value" type="number" step="0.01" defaultValue={goal.current_value ?? ""} />
      <Button type="submit" variant="secondary">Update</Button>
    </form>
  );
}

export function WorkoutSessionForm({ memberId, trainerId = "", assignments = [], goals = [] }: { memberId: string; trainerId?: string; assignments?: WorkoutProgramAssignmentRow[]; goals?: FitnessGoalRow[] }) {
  const [state, formAction] = useActionState(saveWorkoutSessionAction, initialAuthActionState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <HiddenInput name="trainerId" value={trainerId} />
      <Field id={`workout-title-${memberId}`} label="Workout Title" name="workoutTitle" state={state}><Input id={`workout-title-${memberId}`} name="workoutTitle" placeholder="Upper Strength Session" /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="sessionDate" type="date" defaultValue={today} aria-label="Session date" />
        <Input name="durationMinutes" type="number" placeholder="Duration minutes" aria-label="Duration minutes" />
        <Select name="status" label="Status" defaultValue="completed">
          <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="skipped">Skipped</option><option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <select className={selectClass} name="workoutAssignmentId" defaultValue="" aria-label="Workout assignment">
          <option value="">No assignment</option>
          {assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.starts_on} program</option>)}
        </select>
        <select className={selectClass} name="fitnessGoalId" defaultValue="" aria-label="Related goal">
          <option value="">No goal</option>
          {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
        </select>
      </div>
      <HiddenInput name="source" value={trainerId ? "trainer_logged" : "manual"} />
      <Textarea name="notes" placeholder="Session notes, fatigue, form cues, or recovery context." />
      <AuthSubmitButton>Log Workout</AuthSubmitButton>
    </form>
  );
}

export function ExerciseLogForm({ memberId, workoutSessionId, exercises }: { memberId: string; workoutSessionId: string; exercises: ExerciseRow[] }) {
  const [state, formAction] = useActionState(addExerciseLogAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <HiddenInput name="workoutSessionId" value={workoutSessionId} />
      <select className={selectClass} name="exerciseId" defaultValue="" aria-label="Exercise">
        <option value="">Custom exercise</option>
        {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
      </select>
      <Input name="exerciseName" placeholder="Exercise name" />
      <div className="grid gap-3 md:grid-cols-4">
        <Input name="setNumber" defaultValue="1" type="number" aria-label="Set number" />
        <Input name="repsCompleted" placeholder="Reps" type="number" aria-label="Reps completed" />
        <Input name="weightUsed" placeholder="Weight" type="number" step="0.01" aria-label="Weight used" />
        <select className={selectClass} name="weightUnit" defaultValue="kg" aria-label="Weight unit"><option value="kg">kg</option><option value="lb">lb</option><option value="bodyweight">Bodyweight</option></select>
      </div>
      <Button className="w-full" type="submit" variant="secondary">Add Set</Button>
    </form>
  );
}

export function BodyMeasurementForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(saveBodyMeasurementAction, initialAuthActionState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <Input name="recordedOn" type="date" defaultValue={today} aria-label="Recorded date" />
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="weightKg" placeholder="Weight kg" type="number" step="0.01" />
        <Input name="heightCm" placeholder="Height cm" type="number" step="0.01" />
        <Input name="bodyFatPercentage" placeholder="Body fat %" type="number" step="0.01" />
        <Input name="muscleMassKg" placeholder="Muscle mass kg" type="number" step="0.01" />
        <Input name="chestCm" placeholder="Chest cm" type="number" step="0.01" />
        <Input name="waistCm" placeholder="Waist cm" type="number" step="0.01" />
        <Input name="hipsCm" placeholder="Hips cm" type="number" step="0.01" />
        <Input name="armsCm" placeholder="Arms cm" type="number" step="0.01" />
        <Input name="thighsCm" placeholder="Thighs cm" type="number" step="0.01" />
      </div>
      <Textarea name="notes" placeholder="Measurement context and notes" />
      <AuthSubmitButton>Save Measurements</AuthSubmitButton>
    </form>
  );
}

export function ProgressPhotoForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(saveProgressPhotoAction, initialAuthActionState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="photoDate" type="date" defaultValue={today} aria-label="Photo date" />
        <Select name="viewType" label="View" defaultValue="front"><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option></Select>
        <Select name="visibility" label="Visibility" defaultValue="member_and_trainer"><option value="member_only">Member only</option><option value="member_and_trainer">Member and trainer</option><option value="staff">Staff</option></Select>
      </div>
      <Input accept="image/jpeg,image/png,image/webp" name="photoFile" type="file" aria-label="Progress photo" />
      <Textarea name="notes" placeholder="Optional photo notes" />
      <AuthSubmitButton>Upload Photo</AuthSubmitButton>
    </form>
  );
}

export function NutritionPlanForm({ memberId, trainerId = "" }: { memberId: string; trainerId?: string }) {
  const [state, formAction] = useActionState(saveNutritionPlanAction, initialAuthActionState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <HiddenInput name="trainerId" value={trainerId} />
      <Field id={`nutrition-name-${memberId}`} label="Plan Name" name="name" state={state}><Input id={`nutrition-name-${memberId}`} name="name" placeholder="Lean muscle nutrition block" /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Select name="planType" label="Plan type" defaultValue="maintenance"><option value="weight_loss">Weight loss</option><option value="muscle_gain">Muscle gain</option><option value="maintenance">Maintenance</option><option value="custom">Custom</option></Select>
        <Input name="targetCalories" placeholder="Calories" type="number" aria-label="Target calories" />
        <Input name="waterTargetMl" defaultValue="2500" placeholder="Water ml" type="number" aria-label="Water target" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="targetProteinG" placeholder="Protein g" type="number" step="0.01" />
        <Input name="targetCarbsG" placeholder="Carbs g" type="number" step="0.01" />
        <Input name="targetFatG" placeholder="Fat g" type="number" step="0.01" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="startsOn" type="date" defaultValue={today} aria-label="Plan start" />
        <Input name="endsOn" type="date" aria-label="Plan end" />
        <Select name="status" label="Status" defaultValue="active"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option></Select>
      </div>
      <Textarea name="description" placeholder="Plan rules, preferences, and meal timing guidance." />
      <AuthSubmitButton>Save Nutrition Plan</AuthSubmitButton>
    </form>
  );
}

export function MealPlanForm({ nutritionPlan, memberId }: { nutritionPlan: NutritionPlanWithMeals; memberId: string }) {
  const [state, formAction] = useActionState(saveMealPlanAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="nutritionPlanId" value={nutritionPlan.id} />
      <HiddenInput name="memberId" value={memberId} />
      <Select name="mealType" label="Meal" defaultValue="breakfast"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></Select>
      <Input name="title" placeholder="Meal title" />
      <div className="grid gap-3 md:grid-cols-4">
        <Input name="calories" defaultValue="0" type="number" aria-label="Calories" />
        <Input name="proteinG" defaultValue="0" type="number" step="0.01" aria-label="Protein" />
        <Input name="carbsG" defaultValue="0" type="number" step="0.01" aria-label="Carbs" />
        <Input name="fatG" defaultValue="0" type="number" step="0.01" aria-label="Fat" />
      </div>
      <Textarea name="description" placeholder="Food options and portion notes" />
      <Button className="w-full" type="submit" variant="secondary">Add Meal</Button>
    </form>
  );
}

export function MealEntryForm({ memberId, nutritionPlans }: { memberId: string; nutritionPlans: NutritionPlanWithMeals[] }) {
  const [state, formAction] = useActionState(saveMealEntryAction, initialAuthActionState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="entryDate" type="date" defaultValue={today} aria-label="Entry date" />
        <Select name="mealType" label="Meal" defaultValue="breakfast"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></Select>
        <Select name="adherenceStatus" label="Adherence" defaultValue="logged"><option value="planned">Planned</option><option value="logged">Logged</option><option value="off_plan">Off plan</option><option value="skipped">Skipped</option></Select>
      </div>
      <select className={selectClass} name="nutritionPlanId" defaultValue={nutritionPlans.find((plan) => plan.status === "active")?.id ?? ""} aria-label="Nutrition plan">
        <option value="">No plan</option>
        {nutritionPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select>
      <Input name="foodName" placeholder="Food or meal name" />
      <div className="grid gap-3 md:grid-cols-5">
        <Input name="calories" defaultValue="0" type="number" aria-label="Calories" />
        <Input name="proteinG" defaultValue="0" type="number" step="0.01" aria-label="Protein" />
        <Input name="carbsG" defaultValue="0" type="number" step="0.01" aria-label="Carbs" />
        <Input name="fatG" defaultValue="0" type="number" step="0.01" aria-label="Fat" />
        <Input name="waterMl" defaultValue="0" type="number" aria-label="Water ml" />
      </div>
      <AuthSubmitButton>Log Meal</AuthSubmitButton>
    </form>
  );
}

export function FitnessMilestoneForm({ memberId, goals = [] }: { memberId: string; goals?: FitnessGoalRow[] }) {
  const [state, formAction] = useActionState(saveFitnessMilestoneAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="memberId" value={memberId} />
      <select className={selectClass} name="fitnessGoalId" defaultValue="" aria-label="Related goal">
        <option value="">No goal</option>
        {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
      </select>
      <Select name="milestoneType" label="Milestone" defaultValue="custom"><option value="first_workout">First workout</option><option value="workouts_completed">Workouts completed</option><option value="weight_change">Weight change</option><option value="attendance_count">Attendance count</option><option value="goal_completed">Goal completed</option><option value="streak">Streak</option><option value="custom">Custom</option></Select>
      <Input name="title" placeholder="Milestone title" />
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="metricValue" placeholder="Metric value" type="number" step="0.01" />
        <Input name="badgeKey" placeholder="badge-key" />
      </div>
      <Textarea name="description" placeholder="Milestone details" />
      <AuthSubmitButton>Award Milestone</AuthSubmitButton>
    </form>
  );
}

export function WorkoutSessionExerciseLogPanel({ session, memberId, exercises }: { session: WorkoutSessionWithLogs; memberId: string; exercises: ExerciseRow[] }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {session.logs.map((log) => (
          <div className="rounded-md border border-border bg-surface p-3 text-sm" key={log.id}>
            <p className="font-bold">{log.exercise_name}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Set {log.set_number} · {log.reps_completed ?? "-"} reps · {log.weight_used ?? "-"} {log.weight_unit}</p>
          </div>
        ))}
      </div>
      <ExerciseLogForm exercises={exercises} memberId={memberId} workoutSessionId={session.id} />
    </div>
  );
}

function Select({ name, label, defaultValue, children }: { name: string; label: string; defaultValue?: string; children: ReactNode }) {
  return (
    <select className={selectClass} name={name} defaultValue={defaultValue} aria-label={label}>
      {children}
    </select>
  );
}

function Field({ id, label, name, state, children }: { id: string; label: string; name: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={id}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string }) {
  return <input name={name} suppressHydrationWarning type="hidden" value={value} />;
}

export function ExerciseDeleteForm({ exerciseId }: { exerciseId: string }) {
  const [state, formAction] = useActionState(deleteExerciseAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="exerciseId" value={exerciseId} />
      <p className="text-sm font-semibold text-destructive">This will permanently delete the exercise from the library.</p>
      <AuthSubmitButton>Delete Exercise</AuthSubmitButton>
    </form>
  );
}
