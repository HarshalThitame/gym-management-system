"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/guards";
import { validateAllowedFile } from "@/lib/security/file-validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { UpdateEmailSchema, UpdateProfileSchema } from "../schemas/profile";

const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarBytes = 2 * 1024 * 1024;
type AvatarUploadResult = { ok: true; url: string | null } | { ok: false; message: string };

export async function updateProfileAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireAuth("/member/profile");

  if (!context.userId) {
    return { status: "error", message: "You must be signed in to update your profile." };
  }

  const parsed = UpdateProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    emergencyContactName: formData.get("emergencyContactName") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    avatarUrl: formData.get("avatarUrl") ?? ""
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const supabase = await createSupabaseServerClient();
  const avatarFile = formData.get("avatarFile");
  const uploadedAvatarUrl: AvatarUploadResult = avatarFile instanceof File && avatarFile.size > 0
    ? await uploadAvatar(supabase, context.userId, avatarFile)
    : { ok: true, url: parsed.data.avatarUrl || null };

  if (!uploadedAvatarUrl.ok) {
    return { status: "error", message: uploadedAvatarUrl.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      emergency_contact_name: parsed.data.emergencyContactName || null,
      emergency_contact_phone: parsed.data.emergencyContactPhone || null,
      avatar_url: uploadedAvatarUrl.url
    })
    .eq("id", context.userId);

  if (error) {
    return { status: "error", message: "Profile update failed. Try again." };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "profile.updated",
    entityType: "profile",
    entityId: context.userId
  });

  revalidatePath("/member/profile");
  return { status: "success", message: "Profile updated." };
}

async function uploadAvatar(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  file: File
): Promise<AvatarUploadResult> {
  if (!avatarMimeTypes.has(file.type)) {
    return { ok: false, message: "Upload a JPG, PNG, or WebP avatar." };
  }

  if (file.size > maxAvatarBytes) {
    return { ok: false, message: "Avatar must be under 2 MB." };
  }

  const validation = await validateAllowedFile(file, avatarMimeTypes, "Upload a valid JPG, PNG, or WebP avatar.");
  if (!validation.ok) {
    return validation;
  }

  const extension = validation.extension;
  const path = `${userId}/avatar.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    contentType: validation.mimeType,
    upsert: true
  });

  if (error) {
    return { ok: false, message: "Avatar upload failed. Try a smaller image or retry later." };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

export async function updateEmailAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireAuth("/member/settings");

  if (!context.userId) {
    return { status: "error", message: "You must be signed in to update your email." };
  }

  const parsed = UpdateEmailSchema.safeParse({
    email: formData.get("email")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });

  if (error) {
    return { status: "error", message: "Email update failed. Sign in again and retry." };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "auth.email_update_requested",
    entityType: "auth_user",
    entityId: context.userId,
    metadata: { email: parsed.data.email }
  });

  return { status: "success", message: "Check your inbox to confirm the new email address." };
}
