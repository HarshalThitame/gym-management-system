"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { requireRole } from "@/lib/auth/guards";
import { hasRequiredRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertFeature } from "@/lib/tenant";
import { calculateCommissionsForSession } from "@/features/organization-owner/actions/commission-actions";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { ClassRow, ClassSessionRow } from "@/types/classes";
import type { Database, Json } from "@/types/database";
import type { MemberRow } from "@/types/membership";
import {
  buildScheduleDates,
  canCancelClassBooking,
  getAvailableSeats,
  hasScheduleConflict,
  isSessionBookable,
  slugifyClassName,
  validateClassEligibility
} from "../lib/business-rules";
import {
  BookClassSchema,
  CancelClassBookingSchema,
  ClassAttendanceSchema,
  ClassCategorySchema,
  ClassScheduleSchema,
  ClassSchema,
  ClassSessionSchema,
  ClassSessionStatusSchema
} from "../schemas/classes";
import { getActiveMembershipForMember } from "../services/class-service";

type AppSupabase = SupabaseClient<Database>;
type ClassNotificationEventType = Database["public"]["Tables"]["class_notification_events"]["Insert"]["event_type"];

export async function saveClassCategoryAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/classes");
  const context = scope;
  const parsed = ClassCategorySchema.safeParse({
    categoryId: formData.get("categoryId") ?? "",
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    colorToken: formData.get("colorToken") ?? "accent",
    status: formData.get("status") ?? "active",
    displayOrder: formData.get("displayOrder") ?? "100"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const gymId = scope.gymId;
  const featureError = await requireClassSchedulingFeature(supabase, getContextOrganizationId(scope), gymId);
  if (featureError) {
    return featureError;
  }
  const slug = slugifyClassName(parsed.data.name);
  const payload = {
    gym_id: gymId,
    name: parsed.data.name,
    slug,
    description: parsed.data.description || null,
    color_token: parsed.data.colorToken,
    status: parsed.data.status,
    display_order: parsed.data.displayOrder,
    created_by: scope.userId
  };
  const result = parsed.data.categoryId
    ? await supabase.from("class_categories").update(payload).eq("id", parsed.data.categoryId).eq("gym_id", scope.gymId).select("*").maybeSingle()
    : await supabase.from("class_categories").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Class category save failed." };
  }

  await writeClassAudit(context, parsed.data.categoryId ? "class_category.updated" : "class_category.created", "class_category", result.data.id, { name: parsed.data.name });
  revalidateClassPaths();
  return { status: "success", message: parsed.data.categoryId ? "Class category updated." : "Class category created." };
}

export async function saveClassAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/classes");
  const context = scope;
  const parsed = ClassSchema.safeParse({
    classId: formData.get("classId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    primaryTrainerId: formData.get("primaryTrainerId") ?? "",
    name: formData.get("name"),
    description: formData.get("description"),
    classType: formData.get("classType"),
    difficulty: formData.get("difficulty"),
    durationMinutes: formData.get("durationMinutes"),
    defaultCapacity: formData.get("defaultCapacity"),
    reservedCapacity: formData.get("reservedCapacity") ?? "0",
    bookingWindowDays: formData.get("bookingWindowDays") ?? "14",
    cancellationWindowHours: formData.get("cancellationWindowHours") ?? "4",
    requirements: formData.get("requirements") ?? "",
    location: formData.get("location") ?? "",
    membershipAccess: formData.get("membershipAccess"),
    requiresApproval: Boolean(formData.get("requiresApproval")),
    priceAmount: formData.get("priceAmount") ?? "0",
    status: formData.get("status") ?? "draft"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const gymId = scope.gymId;
  const slug = slugifyClassName(parsed.data.name);
  const classPayload = {
    gym_id: gymId,
    category_id: parsed.data.categoryId || null,
    name: parsed.data.name,
    slug,
    description: parsed.data.description,
    class_type: parsed.data.classType,
    difficulty: parsed.data.difficulty,
    duration_minutes: parsed.data.durationMinutes,
    default_capacity: parsed.data.defaultCapacity,
    reserved_capacity: parsed.data.reservedCapacity,
    booking_window_days: parsed.data.bookingWindowDays,
    cancellation_window_hours: parsed.data.cancellationWindowHours,
    requirements: parsed.data.requirements || null,
    location: parsed.data.location || null,
    membership_access: parsed.data.membershipAccess,
    requires_approval: parsed.data.requiresApproval,
    price_amount: parsed.data.priceAmount,
    status: parsed.data.status,
    archived_at: parsed.data.status === "archived" ? new Date().toISOString() : null,
    calendar_integration: { google: null, outlook: null, apple: null } as Json,
    created_by: scope.userId
  };
  const classResult = parsed.data.classId
    ? await supabase.from("classes").update(classPayload).eq("id", parsed.data.classId).eq("gym_id", scope.gymId).select("*").maybeSingle()
    : await supabase.from("classes").insert(classPayload).select("*").maybeSingle();

  if (classResult.error || !classResult.data) {
    return { status: "error", message: classResult.error?.message ?? "Class save failed." };
  }

  if (parsed.data.primaryTrainerId) {
    await supabase.from("class_trainers").upsert({
      gym_id: gymId,
      class_id: classResult.data.id,
      trainer_id: parsed.data.primaryTrainerId,
      role: "primary",
      status: "active",
      created_by: scope.userId
    }, { onConflict: "class_id,trainer_id,role" });
  }

  await writeClassAudit(context, parsed.data.classId ? "class.updated" : "class.created", "class", classResult.data.id, { name: parsed.data.name, status: parsed.data.status });
  revalidateClassPaths();
  return { status: "success", message: parsed.data.classId ? "Class updated." : "Class created." };
}

export async function saveClassSessionAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/classes");
  const context = scope;
  const parsed = ClassSessionSchema.safeParse({
    sessionId: formData.get("sessionId") ?? "",
    classId: formData.get("classId"),
    scheduleId: formData.get("scheduleId") ?? "",
    primaryTrainerId: formData.get("primaryTrainerId") ?? "",
    substituteTrainerId: formData.get("substituteTrainerId") ?? "",
    sessionDate: formData.get("sessionDate"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    capacity: formData.get("capacity"),
    reservedCapacity: formData.get("reservedCapacity") ?? "0",
    location: formData.get("location") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const classRow = await getClassById(supabase, parsed.data.classId);
  if (!classRow) {
    return { status: "error", message: "Class not found." };
  }
  if (classRow.gym_id !== scope.gymId) {
    return { status: "error", message: "Class does not belong to this gym." };
  }
  const featureError = await requireClassSchedulingFeature(supabase, getContextOrganizationId(scope), classRow.gym_id);
  if (featureError) {
    return featureError;
  }
  const access = await ensureClassWriteAccess(supabase, context, parsed.data.classId, parsed.data.primaryTrainerId || parsed.data.substituteTrainerId || null);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }
  const conflict = await hasTrainerSessionConflict(supabase, {
    trainerId: parsed.data.substituteTrainerId || parsed.data.primaryTrainerId || null,
    sessionDate: parsed.data.sessionDate,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    ignoreSessionId: parsed.data.sessionId || null
  });
  if (conflict) {
    return { status: "error", message: "Trainer already has a class at this time." };
  }

  const payload = {
    gym_id: classRow.gym_id,
    class_id: classRow.id,
    schedule_id: parsed.data.scheduleId || null,
    primary_trainer_id: parsed.data.primaryTrainerId || null,
    substitute_trainer_id: parsed.data.substituteTrainerId || null,
    session_date: parsed.data.sessionDate,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    capacity: parsed.data.capacity,
    reserved_capacity: parsed.data.reservedCapacity,
    location: parsed.data.location || classRow.location,
    notes: parsed.data.notes || null,
    created_by: scope.userId,
    calendar_payload: { googleEventId: null, outlookEventId: null, appleIcsUid: null } as Json
  };
  const result = parsed.data.sessionId
    ? await supabase.from("class_sessions").update(payload).eq("id", parsed.data.sessionId).eq("gym_id", scope.gymId).select("*").maybeSingle()
    : await supabase.from("class_sessions").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Class session save failed." };
  }

  await logClassSession(supabase, context, result.data, parsed.data.sessionId ? "session_updated" : "session_created", null, result.data.status, null);
  revalidateClassPaths();
  return { status: "success", message: parsed.data.sessionId ? "Class session updated." : "Class session created." };
}

export async function generateClassScheduleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/classes");
  const context = scope;
  const parsed = ClassScheduleSchema.safeParse({
    classId: formData.get("classId"),
    recurrence: formData.get("recurrence"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
    dayOfWeek: formData.get("dayOfWeek") ?? "",
    dayOfMonth: formData.get("dayOfMonth") ?? "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    capacityOverride: formData.get("capacityOverride") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const classRow = await getClassById(supabase, parsed.data.classId);
  if (!classRow) {
    return { status: "error", message: "Class not found." };
  }
  if (classRow.gym_id !== scope.gymId) {
    return { status: "error", message: "Class does not belong to this gym." };
  }
  const featureError = await requireClassSchedulingFeature(supabase, getContextOrganizationId(scope), classRow.gym_id);
  if (featureError) {
    return featureError;
  }
  const primaryTrainer = await getPrimaryTrainerForClass(supabase, classRow.id);
  const scheduleResult = await supabase.from("class_schedules").insert({
    gym_id: classRow.gym_id,
    class_id: classRow.id,
    recurrence: parsed.data.recurrence,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate || null,
    day_of_week: parsed.data.dayOfWeek === "" ? null : Number(parsed.data.dayOfWeek),
    day_of_month: parsed.data.dayOfMonth === "" ? null : Number(parsed.data.dayOfMonth),
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    capacity_override: parsed.data.capacityOverride === "" ? null : Number(parsed.data.capacityOverride),
    notes: parsed.data.notes || null,
    created_by: scope.userId
  }).select("*").maybeSingle();

  if (scheduleResult.error || !scheduleResult.data) {
    return { status: "error", message: scheduleResult.error?.message ?? "Schedule creation failed." };
  }

  const schedule = scheduleResult.data;
  const dates = buildScheduleDates(schedule, 80);
  const existingResult = primaryTrainer
    ? await supabase.from("class_sessions").select("*").eq("primary_trainer_id", primaryTrainer.trainer_id).gte("session_date", dates[0] ?? parsed.data.startDate).lte("session_date", dates.at(-1) ?? parsed.data.startDate)
    : { data: [], error: null };
  if (existingResult.error) {
    return { status: "error", message: existingResult.error.message };
  }
  const rows = dates
    .filter((sessionDate) => !hasScheduleConflict({
      trainerId: primaryTrainer?.trainer_id ?? null,
      sessionDate,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt
    }, existingResult.data ?? []))
    .map((sessionDate) => ({
      gym_id: classRow.gym_id,
      class_id: classRow.id,
      schedule_id: schedule.id,
      primary_trainer_id: primaryTrainer?.trainer_id ?? null,
      session_date: sessionDate,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      capacity: schedule.capacity_override ?? classRow.default_capacity,
      reserved_capacity: Math.min(classRow.reserved_capacity, schedule.capacity_override ?? classRow.default_capacity),
      location: classRow.location,
      created_by: scope.userId,
      calendar_payload: { googleEventId: null, outlookEventId: null, appleIcsUid: null } as Json
    }));

  if (rows.length > 0) {
    const insertResult = await supabase.from("class_sessions").upsert(rows, { onConflict: "class_id,session_date,starts_at", ignoreDuplicates: true }).select("id");
    if (insertResult.error) {
      return { status: "error", message: insertResult.error.message };
    }
  }

  await writeClassAudit(context, "class_schedule.generated", "class", classRow.id, { scheduleId: schedule.id, generatedSessions: rows.length });
  revalidateClassPaths();
  return { status: "success", message: `${rows.length} class session${rows.length === 1 ? "" : "s"} generated.` };
}

export async function bookClassAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["member", "super_admin", "organization_owner", "gym_admin", "reception_staff"], "/member/classes");
  const parsed = BookClassSchema.safeParse({
    sessionId: formData.get("sessionId"),
    memberId: formData.get("memberId") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const member = await getBookingMember(supabase, context, parsed.data.memberId || null);
  if (!member) {
    return { status: "error", message: "Member profile is not connected to this login." };
  }
  const bundle = await getSessionBundle(supabase, parsed.data.sessionId);
  if (!bundle) {
    return { status: "error", message: "Class session not found." };
  }
  if (bundle.session.gym_id !== member.gym_id) {
    return { status: "error", message: "Member cannot book classes outside their gym." };
  }
  const featureError = await requireClassSchedulingFeature(supabase, getContextOrganizationId(context), bundle.session.gym_id);
  if (featureError) {
    return featureError;
  }

  const isStaff = hasRequiredRole(context.roles, ["super_admin", "organization_owner", "gym_admin", "reception_staff"]);
  if (!isStaff && !isSessionBookable(bundle.session, bundle.classRow)) {
    return { status: "error", message: "Booking is not open for this session." };
  }

  const membership = await getActiveMembershipForMember(member.id);
  const eligibility = validateClassEligibility(bundle.classRow, membership);
  if (!eligibility.allowed && !isStaff) {
    return { status: "error", message: eligibility.message };
  }

  const existing = await getExistingClassRegistration(supabase, parsed.data.sessionId, member.id);
  if (existing) {
    return { status: "error", message: existing === "booking" ? "Member already has a booking for this class." : "Member is already on the waitlist." };
  }

  const seats = getAvailableSeats(bundle.session);
  if (seats > 0) {
    const maxBookedCount = bundle.session.capacity - bundle.session.reserved_capacity - 1;
    const { data: claimedSession, error: claimError } = await supabase
      .from("class_sessions")
      .update({ booked_count: bundle.session.booked_count + 1 })
      .eq("id", bundle.session.id)
      .eq("booked_count", bundle.session.booked_count)
      .lte("booked_count", maxBookedCount)
      .select("id")
      .maybeSingle();

    if (claimError) {
      return { status: "error", message: claimError.message };
    }

    if (claimedSession) {
      const { data: booking, error } = await supabase.from("class_bookings").insert({
        gym_id: bundle.session.gym_id,
        session_id: bundle.session.id,
        class_id: bundle.classRow.id,
        member_id: member.id,
        booking_source: isStaff ? "reception" : "member_portal",
        created_by: context.userId,
        metadata: { eligibility: eligibility.reasonCode } as Json
      }).select("*").maybeSingle();

      if (error || !booking) {
        await supabase.rpc("recalculate_class_session_counts", { target_session_id: bundle.session.id });
        return { status: "error", message: error?.message ?? "Class booking failed." };
      }

      await Promise.all([
        supabase.rpc("recalculate_class_session_counts", { target_session_id: bundle.session.id }),
        createClassNotification(supabase, "booking_confirmed", { context, session: bundle.session, classRow: bundle.classRow, member, bookingId: booking.id }),
        logClassSession(supabase, context, bundle.session, "booking_created", null, null, `Booked ${member.full_name}`),
        writeClassAudit(context, "class.booking_created", "class_booking", booking.id, { sessionId: bundle.session.id, memberId: member.id })
      ]);
      revalidateClassPaths();
      return { status: "success", message: "Class booked successfully." };
    }
  }

  const position = await getNextWaitlistPosition(supabase, bundle.session.id);
  const { data: waitlist, error } = await supabase.from("class_waitlists").insert({
    gym_id: bundle.session.gym_id,
    session_id: bundle.session.id,
    class_id: bundle.classRow.id,
    member_id: member.id,
    position,
    created_by: context.userId,
    metadata: { eligibility: eligibility.reasonCode } as Json
  }).select("*").maybeSingle();

  if (error || !waitlist) {
    return { status: "error", message: error?.message ?? "Waitlist join failed." };
  }

  await Promise.all([
    supabase.rpc("recalculate_class_session_counts", { target_session_id: bundle.session.id }),
    logClassSession(supabase, context, bundle.session, "waitlist_joined", null, null, `Waitlist position ${position}`),
    writeClassAudit(context, "class.waitlist_joined", "class_waitlist", waitlist.id, { sessionId: bundle.session.id, memberId: member.id, position })
  ]);
  revalidateClassPaths();
  return { status: "success", message: `Class is full. Added to waitlist at position ${position}.` };
}

export async function cancelClassBookingAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["member", "super_admin", "organization_owner", "gym_admin", "reception_staff"], "/member/classes");
  const parsed = CancelClassBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: booking, error } = await supabase.from("class_bookings").select("*").eq("id", parsed.data.bookingId).maybeSingle();
  if (error || !booking) {
    return { status: "error", message: error?.message ?? "Booking not found." };
  }
  const bundle = await getSessionBundle(supabase, booking.session_id);
  if (!bundle) {
    return { status: "error", message: "Class session not found." };
  }
  const member = await getMemberById(supabase, booking.member_id);
  const isStaff = hasRequiredRole(context.roles, ["super_admin", "organization_owner", "gym_admin", "reception_staff"]);
  if (isStaff && getContextGymId(context) && booking.gym_id !== getContextGymId(context)) {
    return { status: "error", message: "Booking does not belong to this gym." };
  }
  if (!isStaff && member?.user_id !== context.userId) {
    return { status: "error", message: "You can only cancel your own class bookings." };
  }
  if (!isStaff && !canCancelClassBooking(bundle.session, bundle.classRow)) {
    return { status: "error", message: "Cancellation window has closed. Contact reception." };
  }

  const { error: updateError } = await supabase.from("class_bookings").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: parsed.data.reason
  }).eq("id", booking.id);

  if (updateError) {
    return { status: "error", message: updateError.message };
  }

  await Promise.all([
    supabase.rpc("recalculate_class_session_counts", { target_session_id: booking.session_id }),
    createClassNotification(supabase, "booking_cancelled", { context, session: bundle.session, classRow: bundle.classRow, member, bookingId: booking.id }),
    logClassSession(supabase, context, bundle.session, "booking_cancelled", booking.status, "cancelled", parsed.data.reason),
    writeClassAudit(context, "class.booking_cancelled", "class_booking", booking.id, { reason: parsed.data.reason })
  ]);
  await promoteNextWaitlistMember(supabase, context, bundle.session.id);
  revalidateClassPaths();
  return { status: "success", message: "Class booking cancelled." };
}

export async function recordClassAttendanceAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer"], "/trainer/classes");
  const parsed = ClassAttendanceSchema.safeParse({
    sessionId: formData.get("sessionId"),
    bookingId: formData.get("bookingId") ?? "",
    memberId: formData.get("memberId"),
    status: formData.get("status"),
    method: formData.get("method") ?? (hasRequiredRole(context.roles, ["trainer"]) ? "trainer" : "reception"),
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const bundle = await getSessionBundle(supabase, parsed.data.sessionId);
  if (!bundle) {
    return { status: "error", message: "Class session not found." };
  }
  const access = await ensureSessionWriteAccess(supabase, context, bundle.session);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data: attendance, error } = await supabase.from("class_attendance").upsert({
    gym_id: bundle.session.gym_id,
    session_id: bundle.session.id,
    booking_id: parsed.data.bookingId || null,
    class_id: bundle.classRow.id,
    member_id: parsed.data.memberId,
    status: parsed.data.status,
    method: parsed.data.method,
    marked_by: context.userId,
    notes: parsed.data.notes || null
  }, { onConflict: "session_id,member_id" }).select("*").maybeSingle();

  if (error || !attendance) {
    return { status: "error", message: error?.message ?? "Attendance save failed." };
  }

  if (parsed.data.bookingId) {
    await supabase.from("class_bookings").update({
      status: parsed.data.status === "absent" ? "absent" : parsed.data.status === "cancelled" ? "cancelled" : "attended",
      checked_in_at: parsed.data.status === "attended" || parsed.data.status === "late" ? new Date().toISOString() : null
    }).eq("id", parsed.data.bookingId);
  }

  await Promise.all([
    logClassSession(supabase, context, bundle.session, "attendance_marked", null, parsed.data.status, parsed.data.notes || null),
    writeClassAudit(context, "class.attendance_marked", "class_attendance", attendance.id, { sessionId: bundle.session.id, memberId: parsed.data.memberId, status: parsed.data.status })
  ]);

  if (parsed.data.status === "attended" || parsed.data.status === "late") {
    const trainerId = bundle.session.substitute_trainer_id ?? bundle.session.primary_trainer_id;
    if (trainerId) {
      try {
        const orgId = await getOrganizationIdForGym(supabase, bundle.session.gym_id);
        if (orgId) {
          await calculateCommissionsForSession(
            orgId,
            trainerId,
            "class",
            bundle.session.id,
            `Class session #${bundle.session.id.slice(0, 8)}`,
            bundle.classRow.price_amount ?? 0
          );
        }
      } catch {
        // Don't block attendance on commission error
      }
    }
  }

  revalidateClassPaths();
  return { status: "success", message: "Class attendance recorded." };
}

export async function updateClassSessionStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer"], "/trainer/classes");
  const parsed = ClassSessionStatusSchema.safeParse({
    sessionId: formData.get("sessionId"),
    nextStatus: formData.get("nextStatus"),
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const bundle = await getSessionBundle(supabase, parsed.data.sessionId);
  if (!bundle) {
    return { status: "error", message: "Class session not found." };
  }
  const access = await ensureSessionWriteAccess(supabase, context, bundle.session);
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const updatePayload = {
    status: parsed.data.nextStatus,
    cancellation_reason: parsed.data.nextStatus === "cancelled" ? parsed.data.reason || "Class cancelled" : bundle.session.cancellation_reason,
    cancelled_at: parsed.data.nextStatus === "cancelled" ? new Date().toISOString() : bundle.session.cancelled_at,
    completed_at: parsed.data.nextStatus === "completed" ? new Date().toISOString() : bundle.session.completed_at
  };
  const { error } = await supabase.from("class_sessions").update(updatePayload).eq("id", bundle.session.id);
  if (error) {
    return { status: "error", message: error.message };
  }

  if (parsed.data.nextStatus === "cancelled") {
    await Promise.all([
      supabase.from("class_bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: parsed.data.reason || "Class cancelled" }).eq("session_id", bundle.session.id).in("status", ["booked", "checked_in"]),
      supabase.from("class_waitlists").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("session_id", bundle.session.id).eq("status", "waiting"),
      createClassNotification(supabase, "class_cancelled", { context, session: bundle.session, classRow: bundle.classRow, member: null, bookingId: null })
    ]);
  }

  await Promise.all([
    logClassSession(supabase, context, bundle.session, "session_status_changed", bundle.session.status, parsed.data.nextStatus, parsed.data.reason || null),
    writeClassAudit(context, "class.session_status_changed", "class_session", bundle.session.id, { from: bundle.session.status, to: parsed.data.nextStatus })
  ]);
  revalidateClassPaths();
  return { status: "success", message: "Class session updated." };
}

async function getClassById(supabase: AppSupabase, classId: string) {
  const { data, error } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function getSessionBundle(supabase: AppSupabase, sessionId: string): Promise<{ session: ClassSessionRow; classRow: ClassRow } | null> {
  const { data: session, error } = await supabase.from("class_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error || !session) {
    if (error) throw new Error(error.message);
    return null;
  }
  const classRow = await getClassById(supabase, session.class_id);
  return classRow ? { session, classRow } : null;
}

async function getPrimaryTrainerForClass(supabase: AppSupabase, classId: string) {
  const { data, error } = await supabase.from("class_trainers").select("*").eq("class_id", classId).eq("role", "primary").eq("status", "active").maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function hasTrainerSessionConflict(supabase: AppSupabase, input: { trainerId: string | null; sessionDate: string; startsAt: string; endsAt: string; ignoreSessionId: string | null }) {
  if (!input.trainerId) {
    return false;
  }
  const { data, error } = await supabase
    .from("class_sessions")
    .select("id,primary_trainer_id,substitute_trainer_id,session_date,starts_at,ends_at,status")
    .eq("session_date", input.sessionDate)
    .or(`primary_trainer_id.eq.${input.trainerId},substitute_trainer_id.eq.${input.trainerId}`)
    .in("status", ["scheduled", "in_progress"]);
  if (error) {
    throw new Error(error.message);
  }
  return hasScheduleConflict({
    trainerId: input.trainerId,
    sessionDate: input.sessionDate,
    startsAt: input.startsAt,
    endsAt: input.endsAt
  }, (data ?? []).filter((session) => session.id !== input.ignoreSessionId));
}

async function getBookingMember(supabase: AppSupabase, context: AuthContext, requestedMemberId: string | null): Promise<MemberRow | null> {
  const isStaff = hasRequiredRole(context.roles, ["super_admin", "organization_owner", "gym_admin", "reception_staff"]);
  let query = isStaff && requestedMemberId
    ? supabase.from("members").select("*").eq("id", requestedMemberId)
    : supabase.from("members").select("*").eq("user_id", context.userId ?? "");
  const contextGymId = getContextGymId(context);
  if (isStaff && contextGymId) {
    query = query.eq("gym_id", contextGymId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function getMemberById(supabase: AppSupabase, memberId: string) {
  const { data, error } = await supabase.from("members").select("*").eq("id", memberId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function getExistingClassRegistration(supabase: AppSupabase, sessionId: string, memberId: string) {
  const [bookingResult, waitlistResult] = await Promise.all([
    supabase.from("class_bookings").select("id").eq("session_id", sessionId).eq("member_id", memberId).in("status", ["booked", "checked_in", "attended"]).maybeSingle(),
    supabase.from("class_waitlists").select("id").eq("session_id", sessionId).eq("member_id", memberId).eq("status", "waiting").maybeSingle()
  ]);
  if (bookingResult.error || waitlistResult.error) {
    throw new Error(bookingResult.error?.message ?? waitlistResult.error?.message ?? "Registration lookup failed.");
  }
  if (bookingResult.data) return "booking";
  if (waitlistResult.data) return "waitlist";
  return null;
}

async function getNextWaitlistPosition(supabase: AppSupabase, sessionId: string) {
  const { data, error } = await supabase.from("class_waitlists").select("position").eq("session_id", sessionId).eq("status", "waiting").order("position", { ascending: false }).limit(1);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? [])[0]?.position ?? 0) + 1;
}

async function promoteNextWaitlistMember(supabase: AppSupabase, context: AuthContext, sessionId: string) {
  const bundle = await getSessionBundle(supabase, sessionId);
  if (!bundle) return;
  await supabase.rpc("recalculate_class_session_counts", { target_session_id: sessionId });
  const refreshedBundle = await getSessionBundle(supabase, sessionId);
  if (!refreshedBundle || getAvailableSeats(refreshedBundle.session) <= 0) return;

  const { data: waitlist } = await supabase.from("class_waitlists").select("*").eq("session_id", sessionId).eq("status", "waiting").order("position", { ascending: true }).limit(1).maybeSingle();
  if (!waitlist) return;
  const member = await getMemberById(supabase, waitlist.member_id);
  const { data: booking, error } = await supabase.from("class_bookings").insert({
    gym_id: waitlist.gym_id,
    session_id: waitlist.session_id,
    class_id: waitlist.class_id,
    member_id: waitlist.member_id,
    booking_source: "auto_promoted",
    waitlist_id: waitlist.id,
    created_by: context.userId,
    metadata: { promotedFromWaitlist: true } as Json
  }).select("*").maybeSingle();
  if (error || !booking) return;

  await Promise.all([
    supabase.from("class_waitlists").update({ status: "promoted", promoted_at: new Date().toISOString(), promoted_booking_id: booking.id, notified_at: new Date().toISOString() }).eq("id", waitlist.id),
    createClassNotification(supabase, "waitlist_promotion", { context, session: refreshedBundle.session, classRow: refreshedBundle.classRow, member, bookingId: booking.id, waitlistId: waitlist.id }),
    supabase.rpc("recalculate_class_session_counts", { target_session_id: sessionId })
  ]);
}

async function ensureClassWriteAccess(supabase: AppSupabase, context: AuthContext, classId: string, trainerId: string | null): Promise<{ ok: true } | { ok: false; message: string }> {
  if (hasRequiredRole(context.roles, ["super_admin", "organization_owner", "gym_admin", "reception_staff"])) {
    const contextGymId = getContextGymId(context);
    if (contextGymId) {
      const classRow = await getClassById(supabase, classId);
      if (!classRow || classRow.gym_id !== contextGymId) {
        return { ok: false, message: "Class does not belong to this gym." };
      }
    }
    return { ok: true };
  }
  if (!hasRequiredRole(context.roles, ["trainer"])) {
    return { ok: false, message: "Class write access denied." };
  }
  const trainer = await getTrainerForContext(supabase, context);
  if (!trainer) {
    return { ok: false, message: "Trainer profile not connected." };
  }
  if (trainerId && trainerId !== trainer.id) {
    return { ok: false, message: "Trainer can only manage their own class sessions." };
  }
  const { data } = await supabase.from("class_trainers").select("id").eq("class_id", classId).eq("trainer_id", trainer.id).eq("status", "active").maybeSingle();
  return data ? { ok: true } : { ok: false, message: "Trainer is not assigned to this class." };
}

async function ensureSessionWriteAccess(supabase: AppSupabase, context: AuthContext, session: ClassSessionRow): Promise<{ ok: true } | { ok: false; message: string }> {
  if (hasRequiredRole(context.roles, ["super_admin", "organization_owner", "gym_admin", "reception_staff"])) {
    const contextGymId = getContextGymId(context);
    if (contextGymId && session.gym_id !== contextGymId) {
      return { ok: false, message: "Class session does not belong to this gym." };
    }
    return { ok: true };
  }
  const trainer = await getTrainerForContext(supabase, context);
  if (!trainer) {
    return { ok: false, message: "Trainer profile not connected." };
  }
  if (session.primary_trainer_id === trainer.id || session.substitute_trainer_id === trainer.id) {
    return { ok: true };
  }
  const { data } = await supabase.from("class_trainers").select("id").eq("class_id", session.class_id).eq("trainer_id", trainer.id).eq("status", "active").maybeSingle();
  return data ? { ok: true } : { ok: false, message: "Trainer is not assigned to this session." };
}

async function getTrainerForContext(supabase: AppSupabase, context: AuthContext) {
  const { data, error } = await supabase.from("trainers").select("*").eq("user_id", context.userId ?? "").maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function createClassNotification(
  supabase: AppSupabase,
  eventType: ClassNotificationEventType,
  input: {
    context: AuthContext;
    session: ClassSessionRow;
    classRow: ClassRow;
    member: MemberRow | null;
    bookingId: string | null;
    waitlistId?: string | null;
  }
) {
  await supabase.from("class_notification_events").insert({
    gym_id: input.session.gym_id,
    session_id: input.session.id,
    class_id: input.classRow.id,
    booking_id: input.bookingId,
    waitlist_id: input.waitlistId ?? null,
    member_id: input.member?.id ?? null,
    trainer_id: input.session.substitute_trainer_id ?? input.session.primary_trainer_id,
    event_type: eventType,
    metadata: {
      className: input.classRow.name,
      sessionDate: input.session.session_date,
      startsAt: input.session.starts_at,
      actorId: input.context.userId
    } as Json
  });
}

async function logClassSession(supabase: AppSupabase, context: AuthContext, session: ClassSessionRow, action: string, fromStatus: string | null, toStatus: string | null, reason: string | null) {
  await supabase.from("class_session_logs").insert({
    gym_id: session.gym_id,
    session_id: session.id,
    class_id: session.class_id,
    action,
    from_status: fromStatus,
    to_status: toStatus,
    reason,
    actor_id: context.userId,
    metadata: {} as Json
  });
}

async function writeClassAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json = {}) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: getContextGymId(context),
    action,
    entityType,
    entityId,
    metadata
  });
}

function getContextGymId(context: AuthContext) {
  return (context as AuthContext & { gymId?: string | null }).gymId ?? context.profile?.gym_id ?? null;
}

function getContextOrganizationId(context: AuthContext) {
  return (context as AuthContext & { scopedOrganizationId?: string | null }).scopedOrganizationId ?? context.organizationId ?? null;
}

async function requireClassSchedulingFeature(
  supabase: AppSupabase,
  organizationId: string | null,
  gymId: string | null
): Promise<AuthActionState | null> {
  const resolvedOrganizationId = organizationId ?? await getOrganizationIdForGym(supabase, gymId);
  if (!resolvedOrganizationId) {
    return { status: "error", message: "Feature not available on your current plan." };
  }

  try {
    await assertFeature(resolvedOrganizationId, "classSchedulingEnabled");
    return null;
  } catch (error) {
    return { status: "error", message: featureGateMessage(error) };
  }
}

async function getOrganizationIdForGym(supabase: AppSupabase, gymId: string | null) {
  if (!gymId) {
    return null;
  }

  const { data, error } = await supabase.from("gyms").select("organization_id").eq("id", gymId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return data?.organization_id ?? null;
}

function featureGateMessage(error: unknown) {
  return error instanceof Error ? error.message : "Feature not available on your current plan.";
}

function revalidateClassPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/classes");
  revalidatePath("/member");
  revalidatePath("/member/classes");
  revalidatePath("/trainer");
  revalidatePath("/trainer/classes");
  revalidatePath("/admin/reports");
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}
