import { addDays, formatISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BodyMeasurementRow, ExerciseRow, FitnessOperationsDashboard, FitnessProgramAssignment, MealEntryRow, MemberFitnessPortal, NutritionPlanWithMeals, NutritionPlanRow, TrainerFitnessMember, TrainerFitnessPortal, WorkoutSessionRow, WorkoutSessionWithLogs } from "@/types/fitness";
import type { MemberRow } from "@/types/membership";
import type { TrainerRow, WorkoutProgramExerciseRow, WorkoutProgramRow } from "@/types/training";
import { calculateWeightChange, calculateWorkoutStreak, getTodaysNutrition } from "../lib/business-rules";
import type { FitnessReportPayload, FitnessReportType } from "../lib/csv";

type ListExercisesInput = {
  gymId: string | null;
  query?: string | undefined;
  category?: string | undefined;
  difficulty?: string | undefined;
  page?: number;
  pageSize?: number;
};

export async function listExercises(input: ListExercisesInput) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 40, 5), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("exercises")
    .select("*", { count: "exact" })
    .eq("status", "active")
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .range(from, to);

  if (input.gymId) {
    query = query.or(`gym_id.eq.${input.gymId},gym_id.is.null`);
  }

  if (input.query) {
    const escaped = input.query.replace(/[%_,]/g, "");
    query = query.or(`name.ilike.%${escaped}%,primary_muscle_group.ilike.%${escaped}%,equipment.ilike.%${escaped}%`);
  }

  if (input.category && input.category !== "all") {
    query = query.eq("category", input.category as ExerciseRow["category"]);
  }

  if (input.difficulty && input.difficulty !== "all") {
    query = query.eq("difficulty", input.difficulty as ExerciseRow["difficulty"]);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return { exercises: data ?? [], total: count ?? data?.length ?? 0, page, pageSize };
}

export async function getMemberFitnessPortal(userId: string): Promise<MemberFitnessPortal | null> {
  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase.from("members").select("*").eq("user_id", userId).maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    return null;
  }

  const today = todayDate();
  const [goalsResult, assignmentsResult, workoutsResult, measurementsResult, photosResult, nutritionPlansResult, mealEntriesResult, milestonesResult, trainerAssignmentsResult] = await Promise.all([
    supabase.from("fitness_goals").select("*").eq("member_id", member.id).order("starts_on", { ascending: false }).limit(20),
    supabase.from("workout_program_assignments").select("*").eq("member_id", member.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("workout_sessions").select("*").eq("member_id", member.id).order("session_date", { ascending: false }).limit(60),
    supabase.from("body_measurements").select("*").eq("member_id", member.id).order("recorded_on", { ascending: false }).limit(40),
    supabase.from("progress_photos").select("*").eq("member_id", member.id).order("photo_date", { ascending: false }).limit(30),
    supabase.from("nutrition_plans").select("*").eq("member_id", member.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("meal_entries").select("*").eq("member_id", member.id).gte("entry_date", formatISO(addDays(new Date(), -30), { representation: "date" })).order("entry_date", { ascending: false }).limit(200),
    supabase.from("fitness_milestones").select("*").eq("member_id", member.id).order("achieved_at", { ascending: false }).limit(30),
    supabase.from("trainer_assignments").select("*").eq("member_id", member.id).eq("status", "active").order("assigned_at", { ascending: false }).limit(1)
  ]);

  const results = [goalsResult, assignmentsResult, workoutsResult, measurementsResult, photosResult, nutritionPlansResult, mealEntriesResult, milestonesResult, trainerAssignmentsResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const goals = goalsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const workouts = workoutsResult.data ?? [];
  const measurements = measurementsResult.data ?? [];
  const nutritionPlans = nutritionPlansResult.data ?? [];
  const mealEntries = mealEntriesResult.data ?? [];
  const trainerAssignment = (trainerAssignmentsResult.data ?? [])[0] ?? null;
  const trainerIds = Array.from(new Set([
    trainerAssignment?.trainer_id,
    ...goals.map((goal) => goal.trainer_id),
    ...nutritionPlans.map((plan) => plan.trainer_id),
    ...assignments.map((assignment) => assignment.trainer_id),
    ...workouts.map((workout) => workout.trainer_id)
  ].filter((id): id is string => Boolean(id))));
  const programIds = Array.from(new Set([
    ...assignments.map((assignment) => assignment.program_id),
    ...workouts.map((workout) => workout.workout_program_id).filter((id): id is string => Boolean(id))
  ]));
  const nutritionPlanIds = nutritionPlans.map((plan) => plan.id);
  const workoutIds = workouts.map((workout) => workout.id);

  const [trainersById, programsById, programExercisesById, mealPlansByPlanId, exerciseLogsBySessionId] = await Promise.all([
    getTrainersById(trainerIds),
    getProgramsById(programIds),
    getExercisesByProgramId(programIds),
    getMealPlansByNutritionPlanId(nutritionPlanIds),
    getExerciseLogsByWorkoutSessionId(workoutIds)
  ]);

  const activeGoal = goals.find((goal) => goal.status === "active") ?? null;
  const latestWeight = measurements.find((measurement) => measurement.weight_kg !== null)?.weight_kg ?? null;
  const todayNutrition = getTodaysNutrition(mealEntries, today);

  return {
    member,
    trainer: trainerAssignment ? pickTrainer(trainersById.get(trainerAssignment.trainer_id)) : null,
    goals,
    activeGoal,
    programs: assignments.map((assignment): FitnessProgramAssignment => ({
      ...assignment,
      program: programsById.get(assignment.program_id) ?? null,
      exercises: programExercisesById.get(assignment.program_id) ?? [],
      trainer: pickTrainer(trainersById.get(assignment.trainer_id))
    })),
    workoutSessions: workouts.map((workout): WorkoutSessionWithLogs => ({
      ...workout,
      logs: exerciseLogsBySessionId.get(workout.id) ?? [],
      program: workout.workout_program_id ? pickProgram(programsById.get(workout.workout_program_id)) : null,
      goal: workout.fitness_goal_id ? pickGoal(goals.find((goal) => goal.id === workout.fitness_goal_id)) : null
    })),
    measurements,
    progressPhotos: photosResult.data ?? [],
    nutritionPlans: nutritionPlans.map((plan): NutritionPlanWithMeals => ({
      ...plan,
      meals: mealPlansByPlanId.get(plan.id) ?? [],
      trainer: plan.trainer_id ? pickTrainer(trainersById.get(plan.trainer_id)) : null
    })),
    mealEntries,
    milestones: milestonesResult.data ?? [],
    weightTrend: measurements.toSorted((a, b) => a.recorded_on.localeCompare(b.recorded_on)).map((measurement) => ({ date: measurement.recorded_on, weight: measurement.weight_kg, bodyFat: measurement.body_fat_percentage, muscleMass: measurement.muscle_mass_kg, bmi: measurement.bmi })),
    nutritionTrend: buildNutritionTrend(mealEntries),
    adherenceTrend: buildAdherenceTrend(workouts),
    metrics: {
      completedWorkouts: workouts.filter((workout) => workout.status === "completed").length,
      workoutStreak: calculateWorkoutStreak(workouts),
      caloriesToday: todayNutrition.calories,
      waterToday: todayNutrition.water,
      activeGoals: goals.filter((goal) => goal.status === "active").length,
      milestoneCount: milestonesResult.data?.length ?? 0,
      latestWeightKg: latestWeight,
      weightChangeKg: calculateWeightChange(measurements)
    }
  };
}

export async function getTrainerFitnessPortal(userId: string, gymId: string | null): Promise<TrainerFitnessPortal> {
  const supabase = await createSupabaseServerClient();
  let trainerQuery = supabase.from("trainers").select("*").eq("user_id", userId);
  if (gymId) {
    trainerQuery = trainerQuery.eq("gym_id", gymId);
  }

  const { data: trainer, error: trainerError } = await trainerQuery.maybeSingle();
  if (trainerError) {
    throw new Error(trainerError.message);
  }

  if (!trainer) {
    return { trainer: null, members: [], metrics: { assignedMembers: 0, activeGoals: 0, completedWorkouts30Days: 0, membersMissingWorkouts: 0 } };
  }

  const { data: assignments, error: assignmentError } = await supabase.from("trainer_assignments").select("*").eq("trainer_id", trainer.id).eq("status", "active").order("assigned_at", { ascending: false });
  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const memberIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.member_id)));
  const [membersById, summariesByMemberId, goalsByMemberId, measurementsByMemberId, nutritionByMemberId, workoutsByMemberId] = await Promise.all([
    getMembersById(memberIds),
    getProgressSummariesByMemberId(memberIds),
    getGoalsByMemberId(memberIds),
    getLatestMeasurementsByMemberId(memberIds),
    getActiveNutritionPlansByMemberId(memberIds),
    getLatestWorkoutsByMemberId(memberIds)
  ]);

  const members: TrainerFitnessMember[] = [];
  for (const memberId of memberIds) {
    const member = membersById.get(memberId);
    if (!member) {
      continue;
    }

    members.push({
      member,
      summary: summariesByMemberId.get(memberId) ?? null,
      goals: goalsByMemberId.get(memberId) ?? [],
      latestMeasurement: measurementsByMemberId.get(memberId) ?? null,
      activeNutritionPlan: nutritionByMemberId.get(memberId) ?? null,
      lastWorkout: workoutsByMemberId.get(memberId) ?? null
    });
  }

  return {
    trainer,
    members,
    metrics: {
      assignedMembers: members.length,
      activeGoals: members.reduce((total, item) => total + item.goals.filter((goal) => goal.status === "active").length, 0),
      completedWorkouts30Days: members.reduce((total, item) => total + (item.summary?.workouts_last_30_days ?? 0), 0),
      membersMissingWorkouts: members.filter((item) => !item.lastWorkout || item.lastWorkout.session_date < formatISO(addDays(new Date(), -7), { representation: "date" })).length
    }
  };
}

export async function getFitnessOperationsDashboard(gymId: string | null): Promise<FitnessOperationsDashboard> {
  const supabase = await createSupabaseServerClient();
  let summaryQuery = supabase.from("fitness_member_progress_summary").select("*").order("last_workout_date", { ascending: false }).limit(120);
  let milestonesQuery = supabase.from("fitness_milestones").select("id").gte("achieved_at", formatISO(addDays(new Date(), -30)));
  let mealsQuery = supabase.from("meal_entries").select("id").eq("entry_date", todayDate());

  if (gymId) {
    summaryQuery = summaryQuery.eq("gym_id", gymId);
    milestonesQuery = milestonesQuery.eq("gym_id", gymId);
    mealsQuery = mealsQuery.eq("gym_id", gymId);
  }

  const [summariesResult, milestonesResult, mealsResult] = await Promise.all([summaryQuery, milestonesQuery, mealsQuery]);
  const firstError = [summariesResult, milestonesResult, mealsResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const summaries = summariesResult.data ?? [];

  return {
    summaries,
    metrics: {
      trackedMembers: summaries.length,
      activeGoals: summaries.reduce((total, row) => total + (row.active_goals ?? 0), 0),
      completedWorkouts30Days: summaries.reduce((total, row) => total + (row.workouts_last_30_days ?? 0), 0),
      milestonesEarned: milestonesResult.data?.length ?? 0,
      nutritionLogsToday: mealsResult.data?.length ?? 0
    }
  };
}

export async function getFitnessReportRows(gymId: string | null, type: FitnessReportType): Promise<FitnessReportPayload> {
  const supabase = await createSupabaseServerClient();
  let memberQuery = supabase.from("members").select("*").order("created_at", { ascending: false }).limit(500);
  if (gymId) {
    memberQuery = memberQuery.eq("gym_id", gymId);
  }

  const { data: members, error } = await memberQuery;
  if (error) {
    throw new Error(error.message);
  }

  const memberRows = members ?? [];
  const memberIds = memberRows.map((member) => member.id);
  const [goalsByMemberId, workoutsByMemberId, measurementsByMemberId, mealsByMemberId, nutritionPlansByMemberId] = await Promise.all([
    getGoalsByMemberId(memberIds),
    getWorkoutsByMemberId(memberIds),
    getMeasurementsByMemberId(memberIds),
    getMealEntriesByMemberId(memberIds),
    getNutritionPlansByMemberId(memberIds)
  ]);

  return {
    type,
    generatedAt: new Date().toISOString(),
    rows: memberRows.map((member) => ({
      member,
      goals: goalsByMemberId.get(member.id) ?? [],
      workouts: workoutsByMemberId.get(member.id) ?? [],
      measurements: measurementsByMemberId.get(member.id) ?? [],
      meals: mealsByMemberId.get(member.id) ?? [],
      nutritionPlans: nutritionPlansByMemberId.get(member.id) ?? []
    }))
  };
}

async function getMembersById(memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Map<string, MemberRow>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("members").select("*").in("id", memberIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((member) => [member.id, member]));
}

async function getTrainersById(trainerIds: string[]) {
  if (trainerIds.length === 0) {
    return new Map<string, TrainerRow>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("trainers").select("*").in("id", trainerIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((trainer) => [trainer.id, trainer]));
}

async function getProgramsById(programIds: string[]) {
  if (programIds.length === 0) {
    return new Map<string, WorkoutProgramRow>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workout_programs").select("*").in("id", programIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((program) => [program.id, program]));
}

async function getExercisesByProgramId(programIds: string[]) {
  if (programIds.length === 0) {
    return new Map<string, WorkoutProgramExerciseRow[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workout_program_exercises").select("*").in("program_id", programIds).order("day_number", { ascending: true }).order("display_order", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "program_id");
}

async function getMealPlansByNutritionPlanId(planIds: string[]) {
  if (planIds.length === 0) {
    return new Map<string, NutritionPlanWithMeals["meals"]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("meal_plans").select("*").in("nutrition_plan_id", planIds).order("meal_type", { ascending: true }).order("display_order", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "nutrition_plan_id");
}

async function getExerciseLogsByWorkoutSessionId(sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, WorkoutSessionWithLogs["logs"]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("exercise_logs").select("*").in("workout_session_id", sessionIds).order("set_number", { ascending: true }).order("logged_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "workout_session_id");
}

async function getProgressSummariesByMemberId(memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Map<string, TrainerFitnessMember["summary"]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("fitness_member_progress_summary").select("*").in("member_id", memberIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).filter((row) => row.member_id).map((row) => [row.member_id as string, row]));
}

async function getGoalsByMemberId(memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Map<string, TrainerFitnessMember["goals"]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("fitness_goals").select("*").in("member_id", memberIds).order("starts_on", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "member_id");
}

async function getWorkoutsByMemberId(memberIds: string[]): Promise<Map<string, WorkoutSessionRow[]>> {
  if (memberIds.length === 0) {
    return new Map<string, WorkoutSessionRow[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workout_sessions").select("*").in("member_id", memberIds).order("session_date", { ascending: false }).limit(2000);
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "member_id");
}

async function getLatestWorkoutsByMemberId(memberIds: string[]) {
  const workoutsByMemberId = await getWorkoutsByMemberId(memberIds);
  const latest = new Map<string, WorkoutSessionRow | null>();
  for (const [memberId, workouts] of workoutsByMemberId) {
    latest.set(memberId, workouts[0] ?? null);
  }
  return latest;
}

async function getMeasurementsByMemberId(memberIds: string[]): Promise<Map<string, BodyMeasurementRow[]>> {
  if (memberIds.length === 0) {
    return new Map<string, BodyMeasurementRow[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("body_measurements").select("*").in("member_id", memberIds).order("recorded_on", { ascending: false }).limit(2000);
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "member_id");
}

async function getLatestMeasurementsByMemberId(memberIds: string[]) {
  const measurementsByMemberId = await getMeasurementsByMemberId(memberIds);
  const latest = new Map<string, TrainerFitnessMember["latestMeasurement"]>();
  for (const [memberId, measurements] of measurementsByMemberId) {
    latest.set(memberId, measurements[0] ?? null);
  }
  return latest;
}

async function getActiveNutritionPlansByMemberId(memberIds: string[]): Promise<Map<string, NutritionPlanRow | null>> {
  if (memberIds.length === 0) {
    return new Map<string, NutritionPlanRow | null>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("nutrition_plans").select("*").in("member_id", memberIds).eq("status", "active").order("starts_on", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  const plans = groupRows(data ?? [], "member_id");
  const latest = new Map<string, NutritionPlanRow | null>();
  for (const [memberId, rows] of plans) {
    latest.set(memberId, rows[0] ?? null);
  }
  return latest;
}

async function getNutritionPlansByMemberId(memberIds: string[]): Promise<Map<string, NutritionPlanRow[]>> {
  if (memberIds.length === 0) {
    return new Map<string, NutritionPlanRow[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("nutrition_plans").select("*").in("member_id", memberIds).order("starts_on", { ascending: false }).limit(2000);
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "member_id");
}

async function getMealEntriesByMemberId(memberIds: string[]): Promise<Map<string, MealEntryRow[]>> {
  if (memberIds.length === 0) {
    return new Map<string, MealEntryRow[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("meal_entries").select("*").in("member_id", memberIds).order("entry_date", { ascending: false }).limit(5000);
  if (error) {
    throw new Error(error.message);
  }
  return groupRows(data ?? [], "member_id");
}

function buildNutritionTrend(entries: MemberFitnessPortal["mealEntries"]) {
  const grouped = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number; water: number }>();
  for (const entry of entries) {
    const current = grouped.get(entry.entry_date) ?? { date: entry.entry_date, calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 };
    current.calories += entry.calories;
    current.protein += entry.protein_g;
    current.carbs += entry.carbs_g;
    current.fat += entry.fat_g;
    current.water += entry.water_ml;
    grouped.set(entry.entry_date, current);
  }
  return Array.from(grouped.values()).toSorted((a, b) => a.date.localeCompare(b.date));
}

function buildAdherenceTrend(sessions: WorkoutSessionRow[]) {
  const grouped = new Map<string, { week: string; planned: number; completed: number; skipped: number; adherenceRate: number }>();
  for (const session of sessions) {
    const date = new Date(`${session.session_date}T00:00:00`);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    const current = grouped.get(key) ?? { week: key, planned: 0, completed: 0, skipped: 0, adherenceRate: 0 };
    current.planned += 1;
    if (session.status === "completed") {
      current.completed += 1;
    }
    if (session.status === "skipped") {
      current.skipped += 1;
    }
    current.adherenceRate = current.planned > 0 ? Math.round((current.completed / current.planned) * 100) : 0;
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).toSorted((a, b) => a.week.localeCompare(b.week));
}

function groupRows<Key extends string, Row extends Record<Key, string>>(rows: Row[], key: Key) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const current = grouped.get(row[key]) ?? [];
    current.push(row);
    grouped.set(row[key], current);
  }
  return grouped;
}

function pickTrainer(trainer?: TrainerRow) {
  if (!trainer) {
    return null;
  }
  return { id: trainer.id, display_name: trainer.display_name };
}

function pickProgram(program?: WorkoutProgramRow) {
  if (!program) {
    return null;
  }
  return { id: program.id, name: program.name, goal: program.goal, difficulty: program.difficulty };
}

function pickGoal(goal?: MemberFitnessPortal["goals"][number]) {
  if (!goal) {
    return null;
  }
  return { id: goal.id, title: goal.title, goal_type: goal.goal_type, status: goal.status };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
