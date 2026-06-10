"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { hasRequiredRole } from "@/lib/rbac";
import { validateAllowedFile } from "@/lib/security/file-validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Database, Json } from "@/types/database";
import type { FitnessGoalRow } from "@/types/fitness";
import type { MemberRow } from "@/types/membership";
import type { TrainerRow } from "@/types/training";
import { slugifyExerciseName } from "../lib/business-rules";
import {
  BodyMeasurementSchema,
  ExerciseLogSchema,
  ExerciseSchema,
  FitnessGoalSchema,
  FitnessGoalStatusSchema,
  FitnessMilestoneSchema,
  MealEntrySchema,
  MealPlanSchema,
  NutritionPlanSchema,
  ProgressPhotoSchema,
  WorkoutSessionSchema
} from "../schemas/fitness";

type AppSupabase = SupabaseClient<Database>;
type FitnessEventType = Database["public"]["Tables"]["fitness_notification_events"]["Insert"]["event_type"];

const progressPhotoMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxProgressPhotoBytes = 10 * 1024 * 1024;

export async function saveExerciseAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/progress");
  const parsed = ExerciseSchema.safeParse({
    exerciseId: formData.get("exerciseId") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    category: formData.get("category"),
    primaryMuscleGroup: formData.get("primaryMuscleGroup"),
    secondaryMuscleGroups: formData.get("secondaryMuscleGroups") ?? "",
    equipment: formData.get("equipment") ?? "bodyweight",
    difficulty: formData.get("difficulty"),
    instructions: formData.get("instructions"),
    imageUrl: formData.get("imageUrl") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const slug = parsed.data.slug || slugifyExerciseName(parsed.data.name);
  const payload = {
    gym_id: context.profile?.gym_id ?? null,
    name: parsed.data.name,
    slug,
    category: parsed.data.category,
    primary_muscle_group: parsed.data.primaryMuscleGroup,
    secondary_muscle_groups: parsed.data.secondaryMuscleGroups ? parsed.data.secondaryMuscleGroups.split(",").map((item) => item.trim()).filter(Boolean) : [],
    equipment: parsed.data.equipment,
    difficulty: parsed.data.difficulty,
    instructions: parsed.data.instructions,
    image_url: parsed.data.imageUrl || null,
    video_url: parsed.data.videoUrl || null,
    is_system: false,
    status: parsed.data.status,
    created_by: context.userId
  };
  const result = parsed.data.exerciseId
    ? await supabase.from("exercises").update(payload).eq("id", parsed.data.exerciseId).select("id").maybeSingle()
    : await supabase.from("exercises").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Exercise save failed." };
  }

  await writeFitnessAudit(context, parsed.data.exerciseId ? "exercise.updated" : "exercise.created", "exercise", result.data.id, { name: parsed.data.name });
  revalidateFitnessPaths();
  return { status: "success", message: parsed.data.exerciseId ? "Exercise updated." : "Exercise added to library." };
}

export async function saveFitnessGoalAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/fitness");
  const parsed = FitnessGoalSchema.safeParse({
    goalId: formData.get("goalId") ?? "",
    memberId: formData.get("memberId"),
    trainerId: formData.get("trainerId") ?? "",
    goalType: formData.get("goalType"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    targetValue: formData.get("targetValue") ?? "",
    targetUnit: formData.get("targetUnit") ?? "",
    startValue: formData.get("startValue") ?? "",
    currentValue: formData.get("currentValue") ?? "",
    startsOn: formData.get("startsOn"),
    targetDate: formData.get("targetDate") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const trainerId = parsed.data.trainerId || (await getTrainerIdForMemberContext(supabase, context, parsed.data.memberId));
  const payload = {
    gym_id: access.member.gym_id,
    member_id: parsed.data.memberId,
    trainer_id: trainerId,
    goal_type: parsed.data.goalType,
    title: parsed.data.title,
    description: parsed.data.description || null,
    target_value: parsed.data.targetValue ?? null,
    target_unit: parsed.data.targetUnit || null,
    start_value: parsed.data.startValue ?? null,
    current_value: parsed.data.currentValue ?? parsed.data.startValue ?? null,
    starts_on: parsed.data.startsOn,
    target_date: parsed.data.targetDate || null,
    status: parsed.data.status,
    completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
    created_by: context.userId
  };
  const result = parsed.data.goalId
    ? await supabase.from("fitness_goals").update(payload).eq("id", parsed.data.goalId).select("*").maybeSingle()
    : await supabase.from("fitness_goals").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Goal save failed." };
  }

  await Promise.all([
    writeFitnessAudit(context, parsed.data.goalId ? "fitness_goal.updated" : "fitness_goal.created", "fitness_goal", result.data.id, { memberId: parsed.data.memberId, title: parsed.data.title }),
    createFitnessNotification(supabase, access.member, trainerId, parsed.data.status === "completed" ? "goal_completed" : "goal_created", { goalId: result.data.id, title: parsed.data.title })
  ]);
  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: parsed.data.goalId ? "Goal updated." : "Goal created." };
}

export async function updateFitnessGoalStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/fitness");
  const parsed = FitnessGoalStatusSchema.safeParse({
    goalId: formData.get("goalId"),
    status: formData.get("status"),
    currentValue: formData.get("currentValue") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: goal, error: goalError } = await supabase.from("fitness_goals").select("*").eq("id", parsed.data.goalId).maybeSingle();
  if (goalError || !goal) {
    return { status: "error", message: goalError?.message ?? "Goal not found." };
  }

  const access = await ensureMemberFitnessAccess(supabase, context, goal.member_id);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const payload = {
    status: parsed.data.status,
    current_value: parsed.data.currentValue ?? goal.current_value,
    completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null
  };
  const { error } = await supabase.from("fitness_goals").update(payload).eq("id", goal.id);
  if (error) {
    return { status: "error", message: error.message };
  }

  await afterGoalStatusChange(supabase, context, access.member, goal, parsed.data.status);
  revalidateFitnessPaths(goal.member_id);
  return { status: "success", message: "Goal status updated." };
}

export async function saveWorkoutSessionAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/fitness");
  const parsed = WorkoutSessionSchema.safeParse({
    workoutSessionId: formData.get("workoutSessionId") ?? "",
    memberId: formData.get("memberId"),
    trainerId: formData.get("trainerId") ?? "",
    workoutProgramId: formData.get("workoutProgramId") ?? "",
    workoutAssignmentId: formData.get("workoutAssignmentId") ?? "",
    fitnessGoalId: formData.get("fitnessGoalId") ?? "",
    sessionDate: formData.get("sessionDate"),
    startedAt: formData.get("startedAt") ?? "",
    completedAt: formData.get("completedAt") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? "",
    status: formData.get("status") ?? "completed",
    workoutTitle: formData.get("workoutTitle"),
    source: formData.get("source") ?? "manual",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const trainerId = parsed.data.trainerId || (await getTrainerIdForMemberContext(supabase, context, parsed.data.memberId));
  const payload = {
    gym_id: access.member.gym_id,
    member_id: parsed.data.memberId,
    trainer_id: trainerId,
    workout_program_id: parsed.data.workoutProgramId || null,
    workout_assignment_id: parsed.data.workoutAssignmentId || null,
    fitness_goal_id: parsed.data.fitnessGoalId || null,
    session_date: parsed.data.sessionDate,
    started_at: parsed.data.startedAt || null,
    completed_at: parsed.data.status === "completed" ? parsed.data.completedAt || new Date().toISOString() : parsed.data.completedAt || null,
    duration_minutes: parsed.data.durationMinutes ?? null,
    status: parsed.data.status,
    workout_title: parsed.data.workoutTitle,
    source: parsed.data.source,
    notes: parsed.data.notes || null,
    created_by: context.userId
  };
  const result = parsed.data.workoutSessionId
    ? await supabase.from("workout_sessions").update(payload).eq("id", parsed.data.workoutSessionId).select("*").maybeSingle()
    : await supabase.from("workout_sessions").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Workout save failed." };
  }

  await Promise.all([
    maybeAwardWorkoutMilestones(supabase, context, access.member),
    createFitnessNotification(supabase, access.member, trainerId, "workout_logged", { workoutSessionId: result.data.id, status: parsed.data.status }),
    writeFitnessAudit(context, parsed.data.workoutSessionId ? "workout_session.updated" : "workout_session.logged", "workout_session", result.data.id, { memberId: parsed.data.memberId })
  ]);
  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: parsed.data.workoutSessionId ? "Workout updated." : "Workout logged." };
}

export async function addExerciseLogAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/fitness");
  const parsed = ExerciseLogSchema.safeParse({
    workoutSessionId: formData.get("workoutSessionId"),
    memberId: formData.get("memberId"),
    exerciseId: formData.get("exerciseId") ?? "",
    exerciseName: formData.get("exerciseName"),
    setNumber: formData.get("setNumber") ?? "1",
    targetReps: formData.get("targetReps") ?? "",
    repsCompleted: formData.get("repsCompleted") ?? "",
    weightUsed: formData.get("weightUsed") ?? "",
    weightUnit: formData.get("weightUnit") ?? "kg",
    durationSeconds: formData.get("durationSeconds") ?? "",
    distance: formData.get("distance") ?? "",
    distanceUnit: formData.get("distanceUnit") ?? "",
    perceivedEffort: formData.get("perceivedEffort") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { error } = await supabase.from("exercise_logs").insert({
    gym_id: access.member.gym_id,
    workout_session_id: parsed.data.workoutSessionId,
    member_id: parsed.data.memberId,
    exercise_id: parsed.data.exerciseId || null,
    exercise_name: parsed.data.exerciseName,
    set_number: parsed.data.setNumber,
    target_reps: parsed.data.targetReps || null,
    reps_completed: parsed.data.repsCompleted ?? null,
    weight_used: parsed.data.weightUsed ?? null,
    weight_unit: parsed.data.weightUnit,
    duration_seconds: parsed.data.durationSeconds ?? null,
    distance: parsed.data.distance ?? null,
    distance_unit: parsed.data.distanceUnit || null,
    perceived_effort: parsed.data.perceivedEffort ?? null,
    notes: parsed.data.notes || null
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: "Exercise set logged." };
}

export async function saveBodyMeasurementAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/fitness");
  const parsed = BodyMeasurementSchema.safeParse({
    measurementId: formData.get("measurementId") ?? "",
    memberId: formData.get("memberId"),
    recordedOn: formData.get("recordedOn"),
    weightKg: formData.get("weightKg") ?? "",
    heightCm: formData.get("heightCm") ?? "",
    bodyFatPercentage: formData.get("bodyFatPercentage") ?? "",
    muscleMassKg: formData.get("muscleMassKg") ?? "",
    chestCm: formData.get("chestCm") ?? "",
    waistCm: formData.get("waistCm") ?? "",
    hipsCm: formData.get("hipsCm") ?? "",
    armsCm: formData.get("armsCm") ?? "",
    thighsCm: formData.get("thighsCm") ?? "",
    customMeasurements: formData.get("customMeasurements") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const customMeasurements = parseCustomMeasurements(parsed.data.customMeasurements ?? "");
  if (!customMeasurements.ok) {
    return { status: "error", message: customMeasurements.message };
  }

  const payload = {
    gym_id: access.member.gym_id,
    member_id: parsed.data.memberId,
    recorded_on: parsed.data.recordedOn,
    weight_kg: parsed.data.weightKg ?? null,
    height_cm: parsed.data.heightCm ?? null,
    body_fat_percentage: parsed.data.bodyFatPercentage ?? null,
    muscle_mass_kg: parsed.data.muscleMassKg ?? null,
    chest_cm: parsed.data.chestCm ?? null,
    waist_cm: parsed.data.waistCm ?? null,
    hips_cm: parsed.data.hipsCm ?? null,
    arms_cm: parsed.data.armsCm ?? null,
    thighs_cm: parsed.data.thighsCm ?? null,
    custom_measurements: customMeasurements.value,
    notes: parsed.data.notes || null,
    recorded_by: context.userId
  };
  const result = parsed.data.measurementId
    ? await supabase.from("body_measurements").update(payload).eq("id", parsed.data.measurementId).select("id").maybeSingle()
    : await supabase.from("body_measurements").upsert(payload, { onConflict: "member_id,recorded_on" }).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Measurement save failed." };
  }

  await Promise.all([
    createFitnessNotification(supabase, access.member, await getTrainerIdForMemberContext(supabase, context, parsed.data.memberId), "measurement_logged", { measurementId: result.data.id }),
    writeFitnessAudit(context, "body_measurement.logged", "body_measurement", result.data.id, { memberId: parsed.data.memberId })
  ]);
  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: "Measurements saved." };
}

export async function saveProgressPhotoAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/fitness");
  const parsed = ProgressPhotoSchema.safeParse({
    photoId: formData.get("photoId") ?? "",
    memberId: formData.get("memberId"),
    photoDate: formData.get("photoDate"),
    viewType: formData.get("viewType"),
    storagePath: formData.get("storagePath") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    visibility: formData.get("visibility") ?? "member_and_trainer",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const photoFile = formData.get("photoFile");
  const upload = photoFile instanceof File && photoFile.size > 0
    ? await uploadProgressPhoto(supabase, { memberId: parsed.data.memberId, viewType: parsed.data.viewType, actorId: context.userId, file: photoFile })
    : { ok: true as const, filePath: parsed.data.storagePath, fileUrl: parsed.data.imageUrl || null };

  if (!upload.ok) {
    return { status: "error", message: upload.message };
  }

  if (!upload.filePath) {
    return { status: "error", message: "Upload a progress photo or provide an existing storage path." };
  }

  const result = parsed.data.photoId
    ? await supabase.from("progress_photos").update({
        photo_date: parsed.data.photoDate,
        view_type: parsed.data.viewType,
        storage_path: upload.filePath,
        image_url: upload.fileUrl,
        visibility: parsed.data.visibility,
        notes: parsed.data.notes || null,
        uploaded_by: context.userId
      }).eq("id", parsed.data.photoId).select("id").maybeSingle()
    : await supabase.from("progress_photos").insert({
        gym_id: access.member.gym_id,
        member_id: parsed.data.memberId,
        photo_date: parsed.data.photoDate,
        view_type: parsed.data.viewType,
        storage_path: upload.filePath,
        image_url: upload.fileUrl,
        visibility: parsed.data.visibility,
        notes: parsed.data.notes || null,
        uploaded_by: context.userId
      }).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Progress photo save failed." };
  }

  await Promise.all([
    createFitnessNotification(supabase, access.member, await getTrainerIdForMemberContext(supabase, context, parsed.data.memberId), "progress_photo_added", { photoId: result.data.id }),
    writeFitnessAudit(context, "progress_photo.saved", "progress_photo", result.data.id, { memberId: parsed.data.memberId, viewType: parsed.data.viewType })
  ]);
  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: "Progress photo saved." };
}

export async function saveNutritionPlanAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/progress");
  const parsed = NutritionPlanSchema.safeParse({
    nutritionPlanId: formData.get("nutritionPlanId") ?? "",
    memberId: formData.get("memberId"),
    trainerId: formData.get("trainerId") ?? "",
    name: formData.get("name"),
    planType: formData.get("planType"),
    description: formData.get("description") ?? "",
    targetCalories: formData.get("targetCalories"),
    targetProteinG: formData.get("targetProteinG") ?? "0",
    targetCarbsG: formData.get("targetCarbsG") ?? "0",
    targetFatG: formData.get("targetFatG") ?? "0",
    waterTargetMl: formData.get("waterTargetMl") ?? "2500",
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const trainerId = parsed.data.trainerId || (await getTrainerIdForMemberContext(supabase, context, parsed.data.memberId));
  const payload = {
    gym_id: access.member.gym_id,
    member_id: parsed.data.memberId,
    trainer_id: trainerId,
    name: parsed.data.name,
    plan_type: parsed.data.planType,
    description: parsed.data.description || null,
    target_calories: parsed.data.targetCalories,
    target_protein_g: parsed.data.targetProteinG,
    target_carbs_g: parsed.data.targetCarbsG,
    target_fat_g: parsed.data.targetFatG,
    water_target_ml: parsed.data.waterTargetMl,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn || null,
    status: parsed.data.status,
    created_by: context.userId
  };
  const result = parsed.data.nutritionPlanId
    ? await supabase.from("nutrition_plans").update(payload).eq("id", parsed.data.nutritionPlanId).select("*").maybeSingle()
    : await supabase.from("nutrition_plans").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Nutrition plan save failed." };
  }

  await Promise.all([
    createFitnessNotification(supabase, access.member, trainerId, "nutrition_plan_assigned", { nutritionPlanId: result.data.id }),
    writeFitnessAudit(context, parsed.data.nutritionPlanId ? "nutrition_plan.updated" : "nutrition_plan.assigned", "nutrition_plan", result.data.id, { memberId: parsed.data.memberId })
  ]);
  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: parsed.data.nutritionPlanId ? "Nutrition plan updated." : "Nutrition plan assigned." };
}

export async function saveMealPlanAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/progress");
  const parsed = MealPlanSchema.safeParse({
    mealPlanId: formData.get("mealPlanId") ?? "",
    nutritionPlanId: formData.get("nutritionPlanId"),
    memberId: formData.get("memberId"),
    mealType: formData.get("mealType"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    calories: formData.get("calories") ?? "0",
    proteinG: formData.get("proteinG") ?? "0",
    carbsG: formData.get("carbsG") ?? "0",
    fatG: formData.get("fatG") ?? "0",
    displayOrder: formData.get("displayOrder") ?? "100"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const payload = {
    gym_id: access.member.gym_id,
    nutrition_plan_id: parsed.data.nutritionPlanId,
    member_id: parsed.data.memberId,
    meal_type: parsed.data.mealType,
    title: parsed.data.title,
    description: parsed.data.description || null,
    calories: parsed.data.calories,
    protein_g: parsed.data.proteinG,
    carbs_g: parsed.data.carbsG,
    fat_g: parsed.data.fatG,
    display_order: parsed.data.displayOrder
  };
  const result = parsed.data.mealPlanId
    ? await supabase.from("meal_plans").update(payload).eq("id", parsed.data.mealPlanId).select("id").maybeSingle()
    : await supabase.from("meal_plans").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Meal plan save failed." };
  }

  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: parsed.data.mealPlanId ? "Meal plan updated." : "Meal added to plan." };
}

export async function saveMealEntryAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer", "member"], "/member/fitness");
  const parsed = MealEntrySchema.safeParse({
    mealEntryId: formData.get("mealEntryId") ?? "",
    memberId: formData.get("memberId"),
    nutritionPlanId: formData.get("nutritionPlanId") ?? "",
    mealPlanId: formData.get("mealPlanId") ?? "",
    entryDate: formData.get("entryDate"),
    mealType: formData.get("mealType"),
    foodName: formData.get("foodName"),
    calories: formData.get("calories") ?? "0",
    proteinG: formData.get("proteinG") ?? "0",
    carbsG: formData.get("carbsG") ?? "0",
    fatG: formData.get("fatG") ?? "0",
    waterMl: formData.get("waterMl") ?? "0",
    adherenceStatus: formData.get("adherenceStatus") ?? "logged",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const payload = {
    gym_id: access.member.gym_id,
    member_id: parsed.data.memberId,
    nutrition_plan_id: parsed.data.nutritionPlanId || null,
    meal_plan_id: parsed.data.mealPlanId || null,
    entry_date: parsed.data.entryDate,
    meal_type: parsed.data.mealType,
    food_name: parsed.data.foodName,
    calories: parsed.data.calories,
    protein_g: parsed.data.proteinG,
    carbs_g: parsed.data.carbsG,
    fat_g: parsed.data.fatG,
    water_ml: parsed.data.waterMl,
    adherence_status: parsed.data.adherenceStatus,
    notes: parsed.data.notes || null
  };
  const result = parsed.data.mealEntryId
    ? await supabase.from("meal_entries").update(payload).eq("id", parsed.data.mealEntryId).select("id").maybeSingle()
    : await supabase.from("meal_entries").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Meal log save failed." };
  }

  await createFitnessNotification(supabase, access.member, await getTrainerIdForMemberContext(supabase, context, parsed.data.memberId), "meal_logged", { mealEntryId: result.data.id });
  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: parsed.data.mealEntryId ? "Meal log updated." : "Meal logged." };
}

export async function saveFitnessMilestoneAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/progress");
  const parsed = FitnessMilestoneSchema.safeParse({
    milestoneId: formData.get("milestoneId") ?? "",
    memberId: formData.get("memberId"),
    fitnessGoalId: formData.get("fitnessGoalId") ?? "",
    milestoneType: formData.get("milestoneType"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    metricValue: formData.get("metricValue") ?? "",
    badgeKey: formData.get("badgeKey") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureMemberFitnessAccess(supabase, context, parsed.data.memberId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data, error } = await supabase.from("fitness_milestones").insert({
    gym_id: access.member.gym_id,
    member_id: parsed.data.memberId,
    fitness_goal_id: parsed.data.fitnessGoalId || null,
    milestone_type: parsed.data.milestoneType,
    title: parsed.data.title,
    description: parsed.data.description || null,
    metric_value: parsed.data.metricValue ?? null,
    badge_key: parsed.data.badgeKey || null,
    awarded_by: context.userId,
    metadata: {} as Json
  }).select("id").maybeSingle();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Milestone save failed." };
  }

  await Promise.all([
    createFitnessNotification(supabase, access.member, await getTrainerIdForMemberContext(supabase, context, parsed.data.memberId), "milestone_earned", { milestoneId: data.id, title: parsed.data.title }),
    writeFitnessAudit(context, "fitness_milestone.awarded", "fitness_milestone", data.id, { memberId: parsed.data.memberId })
  ]);
  revalidateFitnessPaths(parsed.data.memberId);
  return { status: "success", message: "Milestone awarded." };
}

async function ensureMemberFitnessAccess(supabase: AppSupabase, context: AuthContext, memberId: string): Promise<{ ok: true; member: MemberRow } | { ok: false; message: string }> {
  const { data: member, error } = await supabase.from("members").select("*").eq("id", memberId).maybeSingle();
  if (error || !member) {
    return { ok: false, message: error?.message ?? "Member not found." };
  }

  if (hasRequiredRole(context.roles, ["super_admin"])) {
    return { ok: true, member };
  }

  if (hasRequiredRole(context.roles, ["gym_admin", "reception_staff"]) && member.gym_id === context.profile?.gym_id) {
    return { ok: true, member };
  }

  if (hasRequiredRole(context.roles, ["member"]) && member.user_id === context.userId) {
    return { ok: true, member };
  }

  if (hasRequiredRole(context.roles, ["trainer"])) {
    const trainer = await getTrainerForContext(supabase, context);
    if (!trainer) {
      return { ok: false, message: "Trainer profile is not connected to this login." };
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from("trainer_assignments")
      .select("id")
      .eq("trainer_id", trainer.id)
      .eq("member_id", member.id)
      .eq("status", "active")
      .maybeSingle();

    if (!assignmentError && assignment) {
      return { ok: true, member };
    }
  }

  return { ok: false, message: "You do not have access to this member's fitness data." };
}

async function getTrainerForContext(supabase: AppSupabase, context: AuthContext): Promise<TrainerRow | null> {
  if (!context.userId) {
    return null;
  }

  let query = supabase.from("trainers").select("*").eq("user_id", context.userId);
  if (context.profile?.gym_id) {
    query = query.eq("gym_id", context.profile.gym_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return null;
  }
  return data ?? null;
}

async function getTrainerIdForMemberContext(supabase: AppSupabase, context: AuthContext, memberId: string) {
  const trainer = hasRequiredRole(context.roles, ["trainer"]) ? await getTrainerForContext(supabase, context) : null;
  if (trainer) {
    return trainer.id;
  }

  const { data } = await supabase.from("trainer_assignments").select("trainer_id").eq("member_id", memberId).eq("status", "active").order("assigned_at", { ascending: false }).limit(1).maybeSingle();
  return data?.trainer_id ?? null;
}

async function afterGoalStatusChange(supabase: AppSupabase, context: AuthContext, member: MemberRow, goal: FitnessGoalRow, status: FitnessGoalRow["status"]) {
  const trainerId = goal.trainer_id ?? await getTrainerIdForMemberContext(supabase, context, member.id);
  await writeFitnessAudit(context, "fitness_goal.status_changed", "fitness_goal", goal.id, { from: goal.status, to: status });

  if (status === "completed") {
    await Promise.all([
      createFitnessNotification(supabase, member, trainerId, "goal_completed", { goalId: goal.id }),
      supabase.from("fitness_milestones").insert({
        gym_id: member.gym_id,
        member_id: member.id,
        fitness_goal_id: goal.id,
        milestone_type: "goal_completed",
        title: "Goal Completed",
        description: goal.title,
        badge_key: "goal-completed",
        awarded_by: context.userId,
        metadata: { goalId: goal.id } as Json
      })
    ]);
  }
}

async function maybeAwardWorkoutMilestones(supabase: AppSupabase, context: AuthContext, member: MemberRow) {
  const { data, error } = await supabase.from("workout_sessions").select("id").eq("member_id", member.id).eq("status", "completed");
  if (error) {
    return;
  }

  const completed = data?.length ?? 0;
  const milestone = completed === 1
    ? { type: "first_workout" as const, title: "First Workout", badge: "first-workout" }
    : completed === 10
      ? { type: "workouts_completed" as const, title: "10 Workouts Completed", badge: "10-workouts" }
      : completed === 100
        ? { type: "workouts_completed" as const, title: "100 Workouts Completed", badge: "100-workouts" }
        : null;

  if (!milestone) {
    return;
  }

  await supabase.from("fitness_milestones").insert({
    gym_id: member.gym_id,
    member_id: member.id,
    milestone_type: milestone.type,
    title: milestone.title,
    metric_value: completed,
    badge_key: milestone.badge,
    awarded_by: context.userId,
    metadata: { completedWorkouts: completed } as Json
  });
}

async function uploadProgressPhoto(supabase: AppSupabase, input: { memberId: string; viewType: string; actorId: string | null; file: File }): Promise<{ ok: true; filePath: string; fileUrl: string | null } | { ok: false; message: string }> {
  if (!progressPhotoMimeTypes.has(input.file.type)) {
    return { ok: false, message: "Progress photos must be JPG, PNG, or WebP." };
  }

  if (input.file.size > maxProgressPhotoBytes) {
    return { ok: false, message: "Progress photo must be 10MB or smaller." };
  }

  const validation = await validateAllowedFile(input.file, progressPhotoMimeTypes, "Progress photos must be valid JPG, PNG, or WebP files.");
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const extension = validation.extension;
  const filePath = `${input.memberId}/${Date.now()}-${input.viewType}.${extension}`;
  const { error } = await supabase.storage.from("progress-photos").upload(filePath, input.file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: validation.mimeType
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, filePath, fileUrl: null };
}

async function createFitnessNotification(supabase: AppSupabase, member: MemberRow, trainerId: string | null, eventType: FitnessEventType, metadata: Json) {
  await supabase.from("fitness_notification_events").insert({
    gym_id: member.gym_id,
    member_id: member.id,
    trainer_id: trainerId,
    event_type: eventType,
    metadata
  });
}

async function writeFitnessAudit(context: AuthContext, action: string, entityType: string, entityId: string | null, metadata: Json = {}) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action,
    entityType,
    entityId,
    metadata
  });
}

function parseCustomMeasurements(value: string): { ok: true; value: Json } | { ok: false; message: string } {
  if (!value.trim()) {
    return { ok: true, value: {} };
  }

  try {
    const parsed = JSON.parse(value) as Json;
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: "Custom measurements must be valid JSON." };
  }
}

function revalidateFitnessPaths(memberId?: string) {
  revalidatePath("/member");
  revalidatePath("/member/fitness");
  revalidatePath("/member/workouts");
  revalidatePath("/trainer");
  revalidatePath("/trainer/progress");
  revalidatePath("/trainer/programs");
  revalidatePath("/admin");
  revalidatePath("/admin/fitness");
  revalidatePath("/admin/reports");
  if (memberId) {
    revalidatePath(`/admin/members/${memberId}`);
  }
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0))
  };
}
