"use server";

import { revalidatePath } from "next/cache";
import { formatISO } from "date-fns";
import { validateAllowedFile } from "@/lib/security/file-validation";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import {
  TrainerAvailabilitySelfSchema,
  DeleteAvailabilitySchema,
  TrainerTimeOffSchema,
  CancelTimeOffSchema,
} from "../schemas/training";

export async function saveSelfAvailabilityAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["trainer"], "/trainer/availability");
  const parsed = TrainerAvailabilitySelfSchema.safeParse({
    dayOfWeek: formData.get("dayOfWeek"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    breakStartsAt: formData.get("breakStartsAt") ?? "",
    breakEndsAt: formData.get("breakEndsAt") ?? "",
    isActive: formData.get("isActive") ?? true,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).filter(([, v]) => v && v.length > 0)
      ) as Record<string, string[]>,
    };
  }

  if (parsed.data.endsAt <= parsed.data.startsAt) {
    return { status: "error", message: "End time must be after start time." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("user_id", context.userId!)
    .maybeSingle();

  if (!trainer) {
    return { status: "error", message: "Trainer profile not found. Contact an admin." };
  }

  const { error } = await supabase.from("trainer_availability").upsert({
    trainer_id: trainer.id,
    day_of_week: parsed.data.dayOfWeek,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    break_starts_at: parsed.data.breakStartsAt || null,
    break_ends_at: parsed.data.breakEndsAt || null,
    is_active: parsed.data.isActive,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/trainer/availability");
  return { status: "success", message: "Availability saved." };
}

export async function deleteSelfAvailabilityAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["trainer"], "/trainer/availability");
  const parsed = DeleteAvailabilitySchema.safeParse({
    availabilityId: formData.get("availabilityId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Invalid availability ID." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: availability } = await supabase
    .from("trainer_availability")
    .select("id, trainer_id")
    .eq("id", parsed.data.availabilityId)
    .maybeSingle();

  if (!availability) {
    return { status: "error", message: "Availability slot not found." };
  }

  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("user_id", context.userId!)
    .maybeSingle();

  if (!trainer || trainer.id !== availability.trainer_id) {
    return { status: "error", message: "You can only delete your own availability." };
  }

  const { error } = await supabase.from("trainer_availability").delete().eq("id", parsed.data.availabilityId);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/trainer/availability");
  return { status: "success", message: "Availability slot deleted." };
}

export async function requestTimeOffAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["trainer"], "/trainer/availability");
  const parsed = TrainerTimeOffSchema.safeParse({
    timeOffId: "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).filter(([, v]) => v && v.length > 0)
      ) as Record<string, string[]>,
    };
  }

  if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
    return { status: "error", message: "End date must be after start date." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("user_id", context.userId!)
    .maybeSingle();

  if (!trainer) {
    return { status: "error", message: "Trainer profile not found." };
  }

  const { error } = await supabase.from("trainer_time_off").insert({
    trainer_id: trainer.id,
    starts_at: new Date(parsed.data.startsAt).toISOString(),
    ends_at: new Date(parsed.data.endsAt).toISOString(),
    reason: parsed.data.reason,
    status: "requested",
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "trainer.time_off_requested",
    entityType: "trainer_time_off",
    entityId: "",
    metadata: { reason: parsed.data.reason },
  });

  revalidatePath("/trainer/availability");
  return { status: "success", message: "Time-off request submitted." };
}

export async function cancelTimeOffAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["trainer"], "/trainer/availability");
  const parsed = CancelTimeOffSchema.safeParse({
    timeOffId: formData.get("timeOffId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: timeOff } = await supabase
    .from("trainer_time_off")
    .select("id, trainer_id, status")
    .eq("id", parsed.data.timeOffId)
    .maybeSingle();

  if (!timeOff) {
    return { status: "error", message: "Time-off record not found." };
  }

  if (timeOff.status !== "requested") {
    return { status: "error", message: "Only pending requests can be cancelled." };
  }

  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("user_id", context.userId!)
    .maybeSingle();

  if (!trainer || trainer.id !== timeOff.trainer_id) {
    return { status: "error", message: "You can only cancel your own requests." };
  }

  const { error } = await supabase
    .from("trainer_time_off")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.timeOffId);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/trainer/availability");
  return { status: "success", message: "Time-off request cancelled." };
}

const photoMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 15 * 1024 * 1024;

export async function uploadProgressPhotoAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["trainer"], "/trainer/progress");
  const memberId = formData.get("memberId");
  const photoType = formData.get("photoType") ?? "front";
  const notes = formData.get("notes") ?? "";
  const recordedOn = formData.get("recordedOn") ?? formatISO(new Date(), { representation: "date" });
  const photoFile = formData.get("photoFile");

  if (!memberId || typeof memberId !== "string") {
    return { status: "error", message: "Member ID is required." };
  }

  if (!photoFile || !(photoFile instanceof File) || photoFile.size === 0) {
    return { status: "error", message: "Photo file is required." };
  }

  const validation = await validateAllowedFile(photoFile, photoMimeTypes, "Photo must be JPEG, PNG, or WebP.");
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const supabase = await createSupabaseServerClient();
  const { data: trainer } = await supabase
    .from("trainers")
    .select("id, gym_id")
    .eq("user_id", context.userId!)
    .maybeSingle();

  if (!trainer) {
    return { status: "error", message: "Trainer profile not found." };
  }

  const extension = validation.extension;
  const filePath = `${memberId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("progress-photos").upload(filePath, photoFile, {
    contentType: validation.mimeType,
    upsert: false,
  });

  if (uploadError) {
    return { status: "error", message: uploadError.message };
  }

  const { data: publicUrl } = supabase.storage.from("progress-photos").getPublicUrl(filePath);

  const { error: insertError } = await supabase.from("member_progress_photos").insert({
    gym_id: trainer.gym_id,
    member_id: memberId,
    trainer_id: trainer.id,
    photo_url: publicUrl.publicUrl,
    photo_type: typeof photoType === "string" ? photoType : "front",
    recorded_on: typeof recordedOn === "string" ? recordedOn : formatISO(new Date(), { representation: "date" }),
    notes: typeof notes === "string" && notes ? notes : null,
  });

  if (insertError) {
    return { status: "error", message: insertError.message };
  }

  revalidatePath("/trainer/progress");
  return { status: "success", message: "Progress photo uploaded." };
}

export async function cloneProgramTemplateAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["trainer"], "/trainer/programs");
  const templateId = formData.get("templateId");
  const newName = formData.get("newName");

  if (!templateId || typeof templateId !== "string") {
    return { status: "error", message: "Template ID is required." };
  }
  if (!newName || typeof newName !== "string" || newName.length < 2) {
    return { status: "error", message: "Program name must be at least 2 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("user_id", context.userId!)
    .maybeSingle();

  if (!trainer) {
    return { status: "error", message: "Trainer profile not found." };
  }

  try {
    const { cloneProgramTemplate } = await import("../services/training-service");
    await cloneProgramTemplate(templateId, trainer.id, newName);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Clone failed." };
  }

  revalidatePath("/trainer/programs");
  return { status: "success", message: "Program cloned from template." };
}
