"use server";

import { addDays, formatISO } from "date-fns";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { hasRequiredRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database, Json } from "@/types/database";
import type { AuthContext } from "@/types/auth";
import type { TrainerRow, TrainerSessionRow } from "@/types/training";
import {
  calculatePackageExpiry,
  minutesBetweenTimes,
  slugifyTrainingName,
  validateSessionStatusChange,
  validateSessionWindow
} from "../lib/business-rules";
import {
  AvailabilitySchema,
  CertificationSchema,
  EndTrainerAssignmentSchema,
  PtPackageSchema,
  PtPurchaseSchema,
  StaffProfileSchema,
  TrainerAssignmentSchema,
  TrainerFeedbackSchema,
  TrainerNoteSchema,
  TrainerSchema,
  TrainerSessionSchema,
  TrainerSessionStatusSchema,
  TrainerSpecializationSchema,
  WorkoutAssignmentSchema,
  WorkoutExerciseSchema,
  WorkoutProgramSchema
} from "../schemas/training";

type AppSupabase = SupabaseClient<Database>;

const certificateMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxCertificateBytes = 10 * 1024 * 1024;

export async function saveTrainerAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin"], "/admin/trainers");
  const parsed = TrainerSchema.safeParse({
    trainerId: formData.get("trainerId") ?? "",
    userId: formData.get("userId") ?? "",
    displayName: formData.get("displayName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    headline: formData.get("headline"),
    bio: formData.get("bio") ?? "",
    achievements: formData.get("achievements") ?? "",
    coachingPhilosophy: formData.get("coachingPhilosophy") ?? "",
    instagramUrl: formData.get("instagramUrl") ?? "",
    yearsExperience: formData.get("yearsExperience") ?? "0",
    hourlyRateAmount: formData.get("hourlyRateAmount") ?? "0",
    status: formData.get("status"),
    employmentType: formData.get("employmentType"),
    joinedAt: formData.get("joinedAt"),
    publicVisible: Boolean(formData.get("publicVisible"))
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const gymId = context.profile?.gym_id ?? null;
  const trainerId = parsed.data.trainerId || null;
  const employeeCode = trainerId ? null : await generateTrainerCode(supabase, gymId);
  const trainerPayload = {
    gym_id: gymId,
    user_id: parsed.data.userId || null,
    employee_code: employeeCode ?? undefined,
    display_name: parsed.data.displayName,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    status: parsed.data.status,
    employment_type: parsed.data.employmentType,
    joined_at: parsed.data.joinedAt,
    years_experience: parsed.data.yearsExperience,
    hourly_rate_amount: parsed.data.hourlyRateAmount,
    archived_at: parsed.data.status === "archived" ? new Date().toISOString() : null,
    created_by: context.userId
  };

  const trainerResult = trainerId
    ? await supabase
        .from("trainers")
        .update({
          user_id: trainerPayload.user_id,
          display_name: trainerPayload.display_name,
          email: trainerPayload.email,
          phone: trainerPayload.phone,
          status: trainerPayload.status,
          employment_type: trainerPayload.employment_type,
          joined_at: trainerPayload.joined_at,
          years_experience: trainerPayload.years_experience,
          hourly_rate_amount: trainerPayload.hourly_rate_amount,
          archived_at: trainerPayload.archived_at
        })
        .eq("id", trainerId)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("trainers")
        .insert({
          ...trainerPayload,
          employee_code: employeeCode ?? "TRN-0001"
        })
        .select("*")
        .maybeSingle();

  if (trainerResult.error || !trainerResult.data) {
    return { status: "error", message: trainerResult.error?.message ?? "Trainer save failed." };
  }

  const trainer = trainerResult.data;
  const { error: profileError } = await supabase.from("trainer_profiles").upsert({
    trainer_id: trainer.id,
    headline: parsed.data.headline,
    bio: parsed.data.bio || "",
    achievements: parsed.data.achievements || null,
    coaching_philosophy: parsed.data.coachingPhilosophy || null,
    instagram_url: parsed.data.instagramUrl || null,
    public_visible: parsed.data.publicVisible
  });

  if (profileError) {
    return { status: "error", message: profileError.message };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId,
    action: trainerId ? "trainer.updated" : "trainer.created",
    entityType: "trainer",
    entityId: trainer.id,
    metadata: { displayName: trainer.display_name, status: trainer.status }
  });

  revalidatePath("/admin/trainers");
  revalidatePath(`/admin/trainers/${trainer.id}`);
  return { status: "success", message: trainerId ? "Trainer updated." : "Trainer created." };
}

export async function addTrainerSpecializationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "trainer"], "/admin/trainers");
  const parsed = TrainerSpecializationSchema.safeParse({
    trainerId: formData.get("trainerId"),
    specialization: formData.get("specialization"),
    proficiency: formData.get("proficiency")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureTrainerWriteAccess(supabase, context, parsed.data.trainerId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { error } = await supabase.from("trainer_specializations").upsert({
    trainer_id: parsed.data.trainerId,
    specialization: parsed.data.specialization,
    proficiency: parsed.data.proficiency
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeTrainingAudit(context, "trainer.specialization_added", "trainer", parsed.data.trainerId, { specialization: parsed.data.specialization });
  revalidatePath("/admin/trainers");
  revalidatePath(`/admin/trainers/${parsed.data.trainerId}`);
  revalidatePath("/trainer");
  return { status: "success", message: "Specialization saved." };
}

export async function saveCertificationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "trainer"], "/admin/trainers");
  const parsed = CertificationSchema.safeParse({
    trainerId: formData.get("trainerId"),
    certificationName: formData.get("certificationName"),
    issuingOrganization: formData.get("issuingOrganization"),
    issueDate: formData.get("issueDate") ?? "",
    expiryDate: formData.get("expiryDate") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureTrainerWriteAccess(supabase, context, parsed.data.trainerId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const certificateFile = formData.get("certificateFile");
  const upload = certificateFile instanceof File && certificateFile.size > 0
    ? await uploadCertificateFile(supabase, {
        trainerId: parsed.data.trainerId,
        actorId: context.userId,
        file: certificateFile
      })
    : { ok: true as const, filePath: null, fileUrl: null };

  if (!upload.ok) {
    return { status: "error", message: upload.message };
  }

  const { error } = await supabase.from("trainer_certifications").insert({
    trainer_id: parsed.data.trainerId,
    certification_name: parsed.data.certificationName,
    issuing_organization: parsed.data.issuingOrganization,
    issue_date: parsed.data.issueDate || null,
    expiry_date: parsed.data.expiryDate || null,
    alert_at: parsed.data.expiryDate ? formatISO(addDays(new Date(parsed.data.expiryDate), -30), { representation: "date" }) : null,
    certificate_file_path: upload.filePath,
    certificate_file_url: upload.fileUrl,
    status: parsed.data.status,
    created_by: context.userId
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeTrainingAudit(context, "trainer.certification_added", "trainer", parsed.data.trainerId, { certificationName: parsed.data.certificationName });
  revalidatePath(`/admin/trainers/${parsed.data.trainerId}`);
  revalidatePath("/trainer");
  return { status: "success", message: "Certification saved." };
}

export async function saveAvailabilityAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "trainer"], "/admin/trainers");
  const parsed = AvailabilitySchema.safeParse({
    trainerId: formData.get("trainerId"),
    dayOfWeek: formData.get("dayOfWeek"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    breakStartsAt: formData.get("breakStartsAt") ?? "",
    breakEndsAt: formData.get("breakEndsAt") ?? "",
    isActive: Boolean(formData.get("isActive"))
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.endsAt <= parsed.data.startsAt) {
    return { status: "error", message: "Availability end time must be after start time." };
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureTrainerWriteAccess(supabase, context, parsed.data.trainerId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { error } = await supabase.from("trainer_availability").upsert({
    trainer_id: parsed.data.trainerId,
    day_of_week: parsed.data.dayOfWeek,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    break_starts_at: parsed.data.breakStartsAt || null,
    break_ends_at: parsed.data.breakEndsAt || null,
    is_active: parsed.data.isActive
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeTrainingAudit(context, "trainer.availability_saved", "trainer", parsed.data.trainerId, { dayOfWeek: parsed.data.dayOfWeek });
  revalidatePath(`/admin/trainers/${parsed.data.trainerId}`);
  revalidatePath("/trainer");
  return { status: "success", message: "Availability saved." };
}

export async function assignTrainerAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/trainers");
  const parsed = TrainerAssignmentSchema.safeParse({
    trainerId: formData.get("trainerId"),
    memberId: formData.get("memberId"),
    assignmentType: formData.get("assignmentType"),
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const [trainerResult, memberResult] = await Promise.all([
    supabase.from("trainers").select("*").eq("id", parsed.data.trainerId).maybeSingle(),
    supabase.from("members").select("*").eq("id", parsed.data.memberId).maybeSingle()
  ]);

  if (trainerResult.error || !trainerResult.data) {
    return { status: "error", message: trainerResult.error?.message ?? "Trainer not found." };
  }

  if (memberResult.error || !memberResult.data) {
    return { status: "error", message: memberResult.error?.message ?? "Member not found." };
  }

  if (parsed.data.assignmentType === "primary") {
    await supabase
      .from("trainer_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString(), reason: "Replaced by new primary trainer." })
      .eq("member_id", parsed.data.memberId)
      .eq("assignment_type", "primary")
      .eq("status", "active");
  }

  const { data: assignment, error } = await supabase
    .from("trainer_assignments")
    .insert({
      gym_id: context.profile?.gym_id ?? memberResult.data.gym_id,
      trainer_id: parsed.data.trainerId,
      member_id: parsed.data.memberId,
      assignment_type: parsed.data.assignmentType,
      reason: parsed.data.reason || null,
      created_by: context.userId
    })
    .select("*")
    .maybeSingle();

  if (error || !assignment) {
    return { status: "error", message: error?.message ?? "Trainer assignment failed." };
  }

  if (parsed.data.assignmentType === "primary" && trainerResult.data.user_id) {
    await supabase.from("members").update({ assigned_trainer_id: trainerResult.data.user_id }).eq("id", parsed.data.memberId);
  }

  await Promise.all([
    supabase.from("trainer_notification_events").insert({
      gym_id: assignment.gym_id,
      trainer_id: parsed.data.trainerId,
      member_id: parsed.data.memberId,
      event_type: "trainer_assignment",
      metadata: { assignmentType: parsed.data.assignmentType } as Json
    }),
    writeTrainingAudit(context, "trainer.assignment_created", "trainer_assignment", assignment.id, { trainerId: parsed.data.trainerId, memberId: parsed.data.memberId })
  ]);

  revalidatePath("/admin/trainers");
  revalidatePath(`/admin/members/${parsed.data.memberId}`);
  revalidatePath(`/admin/trainers/${parsed.data.trainerId}`);
  revalidatePath("/trainer");
  return { status: "success", message: "Trainer assigned." };
}

export async function endTrainerAssignmentAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/trainers");
  const parsed = EndTrainerAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    memberId: formData.get("memberId"),
    reason: formData.get("reason")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: assignment, error: loadError } = await supabase.from("trainer_assignments").select("*").eq("id", parsed.data.assignmentId).maybeSingle();

  if (loadError || !assignment) {
    return { status: "error", message: loadError?.message ?? "Assignment not found." };
  }

  const { error } = await supabase
    .from("trainer_assignments")
    .update({ status: "ended", ended_at: new Date().toISOString(), reason: parsed.data.reason })
    .eq("id", parsed.data.assignmentId);

  if (error) {
    return { status: "error", message: error.message };
  }

  if (assignment.assignment_type === "primary") {
    await supabase.from("members").update({ assigned_trainer_id: null }).eq("id", parsed.data.memberId);
  }

  await writeTrainingAudit(context, "trainer.assignment_ended", "trainer_assignment", parsed.data.assignmentId, { reason: parsed.data.reason });
  revalidatePath(`/admin/members/${parsed.data.memberId}`);
  revalidatePath(`/admin/trainers/${assignment.trainer_id}`);
  revalidatePath("/trainer");
  return { status: "success", message: "Assignment ended." };
}

export async function savePtPackageAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin"], "/admin/trainers/packages");
  const parsed = PtPackageSchema.safeParse({
    packageId: formData.get("packageId") ?? "",
    name: formData.get("name"),
    description: formData.get("description"),
    sessionCount: formData.get("sessionCount"),
    validityDays: formData.get("validityDays"),
    priceAmount: formData.get("priceAmount"),
    status: formData.get("status"),
    isPublic: Boolean(formData.get("isPublic")),
    displayOrder: formData.get("displayOrder") ?? "100"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const gymId = context.profile?.gym_id ?? null;
  const packageId = parsed.data.packageId || null;
  const payload = {
    gym_id: gymId,
    name: parsed.data.name,
    slug: slugifyTrainingName(parsed.data.name),
    description: parsed.data.description,
    session_count: parsed.data.sessionCount,
    validity_days: parsed.data.validityDays,
    price_amount: parsed.data.priceAmount,
    status: parsed.data.status,
    is_public: parsed.data.isPublic,
    display_order: parsed.data.displayOrder,
    created_by: context.userId
  };

  const result = packageId
    ? await supabase.from("personal_training_packages").update(payload).eq("id", packageId).select("id").maybeSingle()
    : await supabase.from("personal_training_packages").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "PT package save failed." };
  }

  await writeTrainingAudit(context, packageId ? "pt_package.updated" : "pt_package.created", "personal_training_package", result.data.id, { name: parsed.data.name });
  revalidatePath("/admin/trainers/packages");
  revalidatePath("/admin/trainers");
  return { status: "success", message: packageId ? "PT package updated." : "PT package created." };
}

export async function purchasePtPackageAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/trainers/packages");
  const parsed = PtPurchaseSchema.safeParse({
    memberId: formData.get("memberId"),
    packageId: formData.get("packageId"),
    trainerId: formData.get("trainerId") ?? "",
    startsOn: formData.get("startsOn"),
    paymentStatus: formData.get("paymentStatus")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const [packageResult, memberResult] = await Promise.all([
    supabase.from("personal_training_packages").select("*").eq("id", parsed.data.packageId).maybeSingle(),
    supabase.from("members").select("*").eq("id", parsed.data.memberId).maybeSingle()
  ]);

  if (packageResult.error || !packageResult.data) {
    return { status: "error", message: packageResult.error?.message ?? "PT package not found." };
  }

  if (memberResult.error || !memberResult.data) {
    return { status: "error", message: memberResult.error?.message ?? "Member not found." };
  }

  const gymId = context.profile?.gym_id ?? memberResult.data.gym_id;
  const invoice = await createPtInvoiceAndPayment(supabase, {
    gymId,
    memberId: parsed.data.memberId,
    packageName: packageResult.data.name,
    packageAmount: packageResult.data.price_amount,
    actorId: context.userId,
    isPaid: parsed.data.paymentStatus === "active"
  });

  if (!invoice.ok) {
    return { status: "error", message: invoice.message };
  }

  const { data: memberPackage, error } = await supabase
    .from("member_pt_packages")
    .insert({
      gym_id: gymId,
      member_id: parsed.data.memberId,
      trainer_id: parsed.data.trainerId || null,
      pt_package_id: parsed.data.packageId,
      invoice_id: invoice.invoiceId,
      payment_id: invoice.paymentId,
      status: parsed.data.paymentStatus,
      starts_on: parsed.data.startsOn,
      expires_on: calculatePackageExpiry(parsed.data.startsOn, packageResult.data.validity_days),
      total_sessions: packageResult.data.session_count,
      price_amount: packageResult.data.price_amount,
      created_by: context.userId
    })
    .select("*")
    .maybeSingle();

  if (error || !memberPackage) {
    return { status: "error", message: error?.message ?? "PT purchase failed." };
  }

  await Promise.all([
    parsed.data.trainerId
      ? supabase.from("trainer_notification_events").insert({
          gym_id: gymId,
          trainer_id: parsed.data.trainerId,
          member_id: parsed.data.memberId,
          member_pt_package_id: memberPackage.id,
          event_type: "package_expiry",
          scheduled_for: formatISO(addDays(new Date(memberPackage.expires_on), -7)),
          metadata: { packageName: packageResult.data.name } as Json
        })
      : Promise.resolve(),
    writeTrainingAudit(context, "pt_package.purchased", "member_pt_package", memberPackage.id, { memberId: parsed.data.memberId, packageId: parsed.data.packageId })
  ]);

  revalidatePath(`/admin/members/${parsed.data.memberId}`);
  revalidatePath("/admin/trainers/packages");
  revalidatePath("/trainer");
  return { status: "success", message: "PT package assigned." };
}

export async function saveTrainerSessionAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/sessions");
  const parsed = TrainerSessionSchema.safeParse({
    sessionId: formData.get("sessionId") ?? "",
    trainerId: formData.get("trainerId"),
    memberId: formData.get("memberId"),
    memberPtPackageId: formData.get("memberPtPackageId") ?? "",
    workoutProgramId: formData.get("workoutProgramId") ?? "",
    sessionDate: formData.get("sessionDate"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    workoutType: formData.get("workoutType"),
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const dateError = validateSessionWindow(parsed.data.sessionDate, parsed.data.startsAt, parsed.data.endsAt);
  if (dateError) {
    return { status: "error", message: dateError };
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureTrainerWriteAccess(supabase, context, parsed.data.trainerId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const payload = {
    gym_id: access.trainer.gym_id,
    trainer_id: parsed.data.trainerId,
    member_id: parsed.data.memberId,
    member_pt_package_id: parsed.data.memberPtPackageId || null,
    workout_program_id: parsed.data.workoutProgramId || null,
    session_date: parsed.data.sessionDate,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    duration_minutes: minutesBetweenTimes(parsed.data.sessionDate, parsed.data.startsAt, parsed.data.endsAt),
    workout_type: parsed.data.workoutType,
    notes: parsed.data.notes || null,
    created_by: context.userId
  };
  const sessionId = parsed.data.sessionId || null;
  const result = sessionId
    ? await supabase.from("trainer_sessions").update(payload).eq("id", sessionId).select("*").maybeSingle()
    : await supabase.from("trainer_sessions").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Session save failed. Check for schedule conflicts." };
  }

  await Promise.all([
    supabase.from("trainer_notification_events").insert({
      gym_id: payload.gym_id,
      trainer_id: parsed.data.trainerId,
      member_id: parsed.data.memberId,
      session_id: result.data.id,
      event_type: "session_scheduled",
      metadata: { sessionDate: parsed.data.sessionDate, startsAt: parsed.data.startsAt } as Json
    }),
    writeTrainingAudit(context, sessionId ? "trainer_session.updated" : "trainer_session.created", "trainer_session", result.data.id, { memberId: parsed.data.memberId })
  ]);

  revalidatePath("/trainer");
  revalidatePath("/trainer/sessions");
  revalidatePath(`/admin/trainers/${parsed.data.trainerId}`);
  revalidatePath(`/admin/members/${parsed.data.memberId}`);
  return { status: "success", message: sessionId ? "Session updated." : "Session scheduled." };
}

export async function updateTrainerSessionStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/sessions");
  const parsed = TrainerSessionStatusSchema.safeParse({
    sessionId: formData.get("sessionId"),
    nextStatus: formData.get("nextStatus"),
    reason: formData.get("reason") ?? "",
    completionNotes: formData.get("completionNotes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: session, error: loadError } = await supabase.from("trainer_sessions").select("*").eq("id", parsed.data.sessionId).maybeSingle();

  if (loadError || !session) {
    return { status: "error", message: loadError?.message ?? "Session not found." };
  }

  const access = await ensureTrainerWriteAccess(supabase, context, session.trainer_id);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const transitionError = validateSessionStatusChange(session.status, parsed.data.nextStatus);
  if (transitionError) {
    return { status: "error", message: transitionError };
  }

  const updates: Database["public"]["Tables"]["trainer_sessions"]["Update"] = {
    status: parsed.data.nextStatus,
    completion_notes: parsed.data.completionNotes || session.completion_notes,
    cancel_reason: parsed.data.nextStatus === "cancelled" ? parsed.data.reason || "Cancelled" : session.cancel_reason,
    completed_at: parsed.data.nextStatus === "completed" ? new Date().toISOString() : session.completed_at,
    cancelled_at: parsed.data.nextStatus === "cancelled" ? new Date().toISOString() : session.cancelled_at
  };

  const { error } = await supabase.from("trainer_sessions").update(updates).eq("id", parsed.data.sessionId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await Promise.all([
    supabase.from("trainer_session_logs").insert({
      gym_id: session.gym_id,
      session_id: session.id,
      from_status: session.status,
      to_status: parsed.data.nextStatus,
      reason: parsed.data.reason || null,
      actor_id: context.userId
    }),
    parsed.data.nextStatus === "completed" && session.member_pt_package_id
      ? incrementPtPackageUsage(supabase, session)
      : Promise.resolve(),
    parsed.data.nextStatus === "cancelled"
      ? supabase.from("trainer_notification_events").insert({
          gym_id: session.gym_id,
          trainer_id: session.trainer_id,
          member_id: session.member_id,
          session_id: session.id,
          event_type: "session_cancelled",
          metadata: { reason: parsed.data.reason } as Json
        })
      : Promise.resolve(),
    writeTrainingAudit(context, "trainer_session.status_changed", "trainer_session", session.id, { from: session.status, to: parsed.data.nextStatus })
  ]);

  revalidatePath("/trainer");
  revalidatePath("/trainer/sessions");
  revalidatePath(`/admin/trainers/${session.trainer_id}`);
  revalidatePath(`/admin/members/${session.member_id}`);
  return { status: "success", message: "Session status updated." };
}

export async function saveWorkoutProgramAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/programs");
  const parsed = WorkoutProgramSchema.safeParse({
    programId: formData.get("programId") ?? "",
    trainerId: formData.get("trainerId"),
    memberId: formData.get("memberId") ?? "",
    name: formData.get("name"),
    goal: formData.get("goal"),
    description: formData.get("description") ?? "",
    difficulty: formData.get("difficulty"),
    durationWeeks: formData.get("durationWeeks"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureTrainerWriteAccess(supabase, context, parsed.data.trainerId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const payload = {
    gym_id: access.trainer.gym_id,
    trainer_id: parsed.data.trainerId,
    member_id: parsed.data.memberId || null,
    name: parsed.data.name,
    goal: parsed.data.goal,
    description: parsed.data.description || null,
    difficulty: parsed.data.difficulty,
    duration_weeks: parsed.data.durationWeeks,
    status: parsed.data.status,
    created_by: context.userId
  };
  const programId = parsed.data.programId || null;
  const result = programId
    ? await supabase.from("workout_programs").update(payload).eq("id", programId).select("id").maybeSingle()
    : await supabase.from("workout_programs").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Workout program save failed." };
  }

  await writeTrainingAudit(context, programId ? "workout_program.updated" : "workout_program.created", "workout_program", result.data.id, { name: parsed.data.name });
  revalidatePath("/trainer/programs");
  revalidatePath("/trainer");
  revalidatePath(`/admin/trainers/${parsed.data.trainerId}`);
  return { status: "success", message: programId ? "Workout program updated." : "Workout program created." };
}

export async function addWorkoutExerciseAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/programs");
  const parsed = WorkoutExerciseSchema.safeParse({
    programId: formData.get("programId"),
    dayNumber: formData.get("dayNumber"),
    exerciseName: formData.get("exerciseName"),
    category: formData.get("category") ?? "",
    sets: formData.get("sets"),
    reps: formData.get("reps"),
    restSeconds: formData.get("restSeconds") ?? "",
    tempo: formData.get("tempo") ?? "",
    instructions: formData.get("instructions") ?? "",
    displayOrder: formData.get("displayOrder") ?? "100"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: program, error: programError } = await supabase.from("workout_programs").select("*").eq("id", parsed.data.programId).maybeSingle();

  if (programError || !program) {
    return { status: "error", message: programError?.message ?? "Workout program not found." };
  }

  const access = await ensureTrainerWriteAccess(supabase, context, program.trainer_id);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { error } = await supabase.from("workout_program_exercises").insert({
    program_id: parsed.data.programId,
    day_number: parsed.data.dayNumber,
    exercise_name: parsed.data.exerciseName,
    category: parsed.data.category || null,
    sets: parsed.data.sets,
    reps: parsed.data.reps,
    rest_seconds: parsed.data.restSeconds === "" ? null : Number(parsed.data.restSeconds),
    tempo: parsed.data.tempo || null,
    instructions: parsed.data.instructions || null,
    display_order: parsed.data.displayOrder
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/trainer/programs");
  revalidatePath(`/admin/trainers/${program.trainer_id}`);
  return { status: "success", message: "Exercise added." };
}

export async function assignWorkoutProgramAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/programs");
  const parsed = WorkoutAssignmentSchema.safeParse({
    programId: formData.get("programId"),
    trainerId: formData.get("trainerId"),
    memberId: formData.get("memberId"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureTrainerWriteAccess(supabase, context, parsed.data.trainerId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data: assignment, error } = await supabase
    .from("workout_program_assignments")
    .insert({
      gym_id: access.trainer.gym_id,
      program_id: parsed.data.programId,
      trainer_id: parsed.data.trainerId,
      member_id: parsed.data.memberId,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn || null,
      assigned_by: context.userId
    })
    .select("*")
    .maybeSingle();

  if (error || !assignment) {
    return { status: "error", message: error?.message ?? "Program assignment failed." };
  }

  await Promise.all([
    supabase.from("trainer_notification_events").insert({
      gym_id: access.trainer.gym_id,
      trainer_id: parsed.data.trainerId,
      member_id: parsed.data.memberId,
      event_type: "workout_assigned",
      metadata: { programId: parsed.data.programId } as Json
    }),
    writeTrainingAudit(context, "workout_program.assigned", "workout_program_assignment", assignment.id, { memberId: parsed.data.memberId })
  ]);

  revalidatePath("/trainer/programs");
  revalidatePath("/member/workouts");
  revalidatePath(`/admin/members/${parsed.data.memberId}`);
  return { status: "success", message: "Workout assigned." };
}

export async function saveTrainerNoteAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff", "trainer"], "/trainer/members");
  const parsed = TrainerNoteSchema.safeParse({
    trainerId: formData.get("trainerId"),
    memberId: formData.get("memberId"),
    sessionId: formData.get("sessionId") ?? "",
    noteType: formData.get("noteType"),
    title: formData.get("title"),
    body: formData.get("body"),
    visibility: formData.get("visibility")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const access = await ensureTrainerWriteAccess(supabase, context, parsed.data.trainerId);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data: note, error } = await supabase
    .from("trainer_notes")
    .insert({
      gym_id: access.trainer.gym_id,
      trainer_id: parsed.data.trainerId,
      member_id: parsed.data.memberId,
      session_id: parsed.data.sessionId || null,
      note_type: parsed.data.noteType,
      title: parsed.data.title,
      body: parsed.data.body,
      visibility: parsed.data.visibility,
      created_by: context.userId
    })
    .select("id")
    .maybeSingle();

  if (error || !note) {
    return { status: "error", message: error?.message ?? "Note save failed." };
  }

  await writeTrainingAudit(context, "trainer_note.created", "trainer_note", note.id, { memberId: parsed.data.memberId, noteType: parsed.data.noteType });
  revalidatePath("/trainer/members");
  revalidatePath(`/admin/members/${parsed.data.memberId}`);
  return { status: "success", message: "Trainer note saved." };
}

export async function submitTrainerFeedbackAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["member", "super_admin"], "/member/workouts");
  const parsed = TrainerFeedbackSchema.safeParse({
    trainerId: formData.get("trainerId"),
    memberId: formData.get("memberId"),
    sessionId: formData.get("sessionId") ?? "",
    rating: formData.get("rating"),
    feedback: formData.get("feedback") ?? "",
    isPublic: Boolean(formData.get("isPublic"))
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase.from("members").select("id,user_id,gym_id").eq("id", parsed.data.memberId).maybeSingle();

  if (memberError || !member) {
    return { status: "error", message: memberError?.message ?? "Member not found." };
  }

  if (!hasRequiredRole(context.roles, ["super_admin"]) && member.user_id !== context.userId) {
    return { status: "error", message: "You can only submit feedback for your own profile." };
  }

  const { error } = await supabase.from("trainer_feedback").insert({
    gym_id: member.gym_id,
    trainer_id: parsed.data.trainerId,
    member_id: parsed.data.memberId,
    session_id: parsed.data.sessionId || null,
    rating: parsed.data.rating,
    feedback: parsed.data.feedback || null,
    is_public: parsed.data.isPublic
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeTrainingAudit(context, "trainer_feedback.submitted", "trainer", parsed.data.trainerId, { rating: parsed.data.rating });
  revalidatePath("/member/workouts");
  return { status: "success", message: "Feedback submitted." };
}

export async function saveStaffProfileAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin"], "/admin/staff");
  const parsed = StaffProfileSchema.safeParse({
    staffId: formData.get("staffId") ?? "",
    userId: formData.get("userId") ?? "",
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    staffRole: formData.get("staffRole"),
    status: formData.get("status"),
    employmentType: formData.get("employmentType"),
    joinedAt: formData.get("joinedAt")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const gymId = context.profile?.gym_id ?? null;
  const staffId = parsed.data.staffId || null;
  const staffCode = staffId ? null : await generateStaffCode(supabase, gymId);
  const payload = {
    gym_id: gymId,
    user_id: parsed.data.userId || null,
    employee_code: staffCode ?? undefined,
    full_name: parsed.data.fullName,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    staff_role: parsed.data.staffRole,
    status: parsed.data.status,
    employment_type: parsed.data.employmentType,
    joined_at: parsed.data.joinedAt,
    created_by: context.userId
  };

  const result = staffId
    ? await supabase
        .from("staff_profiles")
        .update({
          user_id: payload.user_id,
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          staff_role: payload.staff_role,
          status: payload.status,
          employment_type: payload.employment_type,
          joined_at: payload.joined_at
        })
        .eq("id", staffId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("staff_profiles")
        .insert({
          ...payload,
          employee_code: staffCode ?? "STF-0001"
        })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Staff profile save failed." };
  }

  await writeTrainingAudit(context, staffId ? "staff.updated" : "staff.created", "staff_profile", result.data.id, { role: parsed.data.staffRole });
  revalidatePath("/admin/staff");
  return { status: "success", message: staffId ? "Staff profile updated." : "Staff profile created." };
}

async function ensureTrainerWriteAccess(supabase: AppSupabase, context: AuthContext, trainerId: string): Promise<{ ok: true; trainer: TrainerRow } | { ok: false; message: string }> {
  const { data: trainer, error } = await supabase.from("trainers").select("*").eq("id", trainerId).maybeSingle();

  if (error || !trainer) {
    return { ok: false, message: error?.message ?? "Trainer not found." };
  }

  if (hasRequiredRole(context.roles, ["super_admin", "gym_admin", "reception_staff"])) {
    return { ok: true, trainer };
  }

  if (trainer.user_id && trainer.user_id === context.userId) {
    return { ok: true, trainer };
  }

  return { ok: false, message: "You are not allowed to manage this trainer record." };
}

async function generateTrainerCode(supabase: AppSupabase, gymId: string | null) {
  const { data, error } = await supabase.rpc("generate_trainer_code", { target_gym_id: gymId });
  if (error || !data) {
    return "TRN-0001";
  }
  return data;
}

async function generateStaffCode(supabase: AppSupabase, gymId: string | null) {
  const { data, error } = await supabase.rpc("generate_staff_code", { target_gym_id: gymId });
  if (error || !data) {
    return "STF-0001";
  }
  return data;
}

async function createPtInvoiceAndPayment(
  supabase: AppSupabase,
  input: {
    gymId: string | null;
    memberId: string;
    packageName: string;
    packageAmount: number;
    actorId: string | null;
    isPaid: boolean;
  }
): Promise<{ ok: true; invoiceId: string | null; paymentId: string | null } | { ok: false; message: string }> {
  const invoiceNumberResult = await supabase.rpc("generate_invoice_number", { target_gym_id: input.gymId });
  const invoiceNumber = invoiceNumberResult.data ?? `PT-${Date.now()}`;
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      gym_id: input.gymId,
      member_id: input.memberId,
      invoice_number: invoiceNumber,
      status: input.isPaid ? "paid" : "issued",
      subtotal_amount: input.packageAmount,
      amount_paid: input.isPaid ? input.packageAmount : 0,
      issued_at: new Date().toISOString(),
      paid_at: input.isPaid ? new Date().toISOString() : null,
      created_by: input.actorId,
      notes: `Personal training package: ${input.packageName}`
    })
    .select("id")
    .maybeSingle();

  if (invoiceError || !invoice) {
    return { ok: false, message: invoiceError?.message ?? "Invoice generation failed." };
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    item_type: "personal_training",
    description: input.packageName,
    quantity: 1,
    unit_amount: input.packageAmount
  });

  if (itemError) {
    return { ok: false, message: itemError.message };
  }

  if (input.packageAmount <= 0) {
    return { ok: true, invoiceId: invoice.id, paymentId: null };
  }

  const paymentNumberResult = await supabase.rpc("generate_payment_number", { target_gym_id: input.gymId });
  const paymentNumber = paymentNumberResult.data ?? `PAY-${Date.now()}`;
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      gym_id: input.gymId,
      member_id: input.memberId,
      invoice_id: invoice.id,
      payment_number: paymentNumber,
      payment_type: "personal_training",
      status: input.isPaid ? "paid" : "pending",
      method: "cash",
      provider: "manual",
      amount: input.packageAmount,
      paid_at: input.isPaid ? new Date().toISOString() : null,
      collected_at: input.isPaid ? new Date().toISOString() : null,
      created_by: input.actorId,
      metadata: { source: "pt_package_assignment" } as Json
    })
    .select("id")
    .maybeSingle();

  if (paymentError || !payment) {
    return { ok: false, message: paymentError?.message ?? "Payment record creation failed." };
  }

  return { ok: true, invoiceId: invoice.id, paymentId: payment.id };
}

async function incrementPtPackageUsage(supabase: AppSupabase, session: TrainerSessionRow) {
  if (!session.member_pt_package_id) {
    return;
  }

  const { data: memberPackage } = await supabase
    .from("member_pt_packages")
    .select("id,total_sessions,used_sessions")
    .eq("id", session.member_pt_package_id)
    .maybeSingle();

  if (!memberPackage) {
    return;
  }

  const nextUsedSessions = Math.min(memberPackage.used_sessions + 1, memberPackage.total_sessions);
  await supabase
    .from("member_pt_packages")
    .update({
      used_sessions: nextUsedSessions,
      status: nextUsedSessions >= memberPackage.total_sessions ? "completed" : "active"
    })
    .eq("id", memberPackage.id);
}

async function uploadCertificateFile(
  supabase: AppSupabase,
  input: { trainerId: string; actorId: string | null; file: File }
): Promise<{ ok: true; filePath: string; fileUrl: string } | { ok: true; filePath: null; fileUrl: null } | { ok: false; message: string }> {
  if (!certificateMimeTypes.has(input.file.type)) {
    return { ok: false, message: "Certificate must be an image or PDF." };
  }

  if (input.file.size > maxCertificateBytes) {
    return { ok: false, message: "Certificate file cannot exceed 10 MB." };
  }

  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "file";
  const filePath = `${input.trainerId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("trainer-certificates").upload(filePath, input.file, {
    contentType: input.file.type,
    upsert: false
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, filePath, fileUrl: filePath };
}

async function writeTrainingAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json = {}) {
  await Promise.all([
    writeAuditLog({
      actorId: context.userId,
      gymId: context.profile?.gym_id ?? null,
      action,
      entityType,
      entityId,
      metadata
    }),
    createStaffActivityLog(context, action, entityType, entityId, metadata)
  ]);
}

async function createStaffActivityLog(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json) {
  if (!context.isAuthenticated) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("staff_activity_logs").insert({
    gym_id: context.profile?.gym_id ?? null,
    staff_user_id: context.userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  });
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}
