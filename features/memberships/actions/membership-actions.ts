"use server";

import { addDays, formatISO, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { validateAllowedFile } from "@/lib/security/file-validation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database, Json } from "@/types/database";
import type { MemberDocumentType, MembershipEvent, MembershipPlanRow, MembershipRow, MembershipStatus } from "@/types/membership";
import {
  calculateEndDate,
  classifyPlanChange,
  formatDateInput,
  slugifyPlanName,
  validateMembershipDates,
  validateRenewalSource,
  validateStatusTransition
} from "../lib/business-rules";
import { buildPlanFeatures, planFeatureCatalog } from "../lib/feature-catalog";
import {
  DocumentUploadSchema,
  MemberOnboardingSchema,
  MembershipAssignmentSchema,
  MembershipPlanSchema,
  PlanChangeSchema,
  RenewalSchema,
  StatusChangeSchema
} from "../schemas/membership";

const memberDocumentMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxMemberDocumentBytes = 10 * 1024 * 1024;

type BillingEventType = Database["public"]["Tables"]["billing_events"]["Insert"]["event_type"];
type PaymentType = Database["public"]["Tables"]["payments"]["Insert"]["payment_type"];

export async function saveMembershipPlanAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin"], "/admin/membership-plans");
  const parsed = MembershipPlanSchema.safeParse({
    planId: formData.get("planId") ?? "",
    name: formData.get("name"),
    description: formData.get("description"),
    planType: formData.get("planType"),
    durationDays: formData.get("durationDays"),
    priceAmount: formData.get("priceAmount"),
    joiningFeeAmount: formData.get("joiningFeeAmount") ?? "0",
    accessLevel: formData.get("accessLevel"),
    status: formData.get("status"),
    isPublic: Boolean(formData.get("isPublic")),
    displayOrder: formData.get("displayOrder") ?? "100"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const enabledFeatures = formData.getAll("features").map(String);
  const featureQuantities = readFeatureQuantities(formData);
  const features = buildPlanFeatures(enabledFeatures, featureQuantities);
  const gymId = context.profile?.gym_id ?? null;
  const slug = slugifyPlanName(parsed.data.name);
  const payload = {
    gym_id: gymId,
    name: parsed.data.name,
    slug,
    description: parsed.data.description,
    plan_type: parsed.data.planType,
    duration_days: parsed.data.durationDays,
    price_amount: parsed.data.priceAmount,
    joining_fee_amount: parsed.data.joiningFeeAmount,
    access_level: parsed.data.accessLevel,
    features: features as unknown as Json,
    status: parsed.data.status,
    is_public: parsed.data.isPublic,
    display_order: parsed.data.displayOrder,
    created_by: context.userId
  };

  const planId = parsed.data.planId || null;
  const isEdit = Boolean(planId);
  const result = isEdit
    ? await supabase
        .from("membership_plans")
        .update({
          ...payload,
          archived_at: parsed.data.status === "archived" ? new Date().toISOString() : null
        })
        .eq("id", planId ?? "")
        .select("id")
        .maybeSingle()
    : await supabase.from("membership_plans").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Plan save failed." };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId,
    action: isEdit ? "membership_plan.updated" : "membership_plan.created",
    entityType: "membership_plan",
    entityId: result.data.id,
    metadata: { name: parsed.data.name, status: parsed.data.status }
  });

  revalidatePath("/admin/membership-plans");
  revalidatePath("/membership-plans");
  return { status: "success", message: isEdit ? "Plan updated." : "Plan created." };
}

export async function updatePlanStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin"], "/admin/membership-plans");
  const planId = String(formData.get("planId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!planId || !["active", "archived", "draft"].includes(status)) {
    return { status: "error", message: "Invalid plan status update." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("membership_plans")
    .update({
      status: status as MembershipPlanRow["status"],
      archived_at: status === "archived" ? new Date().toISOString() : null
    })
    .eq("id", planId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "membership_plan.status_changed",
    entityType: "membership_plan",
    entityId: planId,
    metadata: { status }
  });

  revalidatePath("/admin/membership-plans");
  return { status: "success", message: "Plan status updated." };
}

export async function onboardMemberAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members/new");
  const parsed = MemberOnboardingSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone"),
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    gender: formData.get("gender") ?? "",
    address: formData.get("address") ?? "",
    emergencyContactName: formData.get("emergencyContactName") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    assignedTrainerId: formData.get("assignedTrainerId") ?? "",
    notes: formData.get("notes") ?? "",
    planId: formData.get("planId"),
    startDate: formData.get("startDate"),
    paymentStatus: formData.get("paymentStatus"),
    discountAmount: formData.get("discountAmount") ?? "0"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const gymId = context.profile?.gym_id ?? null;
  const plan = await loadPlan(supabase, parsed.data.planId);

  if (!plan || plan.status !== "active") {
    return { status: "error", message: "Choose an active membership plan." };
  }

  const endDate = calculateEndDate(parsed.data.startDate, plan.duration_days);
  const dateError = validateMembershipDates(parsed.data.startDate, endDate);

  if (dateError) {
    return { status: "error", message: dateError };
  }

  const memberCode = await generateMemberCode(supabase, gymId);
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      gym_id: gymId,
      member_code: memberCode,
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      date_of_birth: parsed.data.dateOfBirth || null,
      gender: parsed.data.gender || null,
      address: parsed.data.address || null,
      emergency_contact_name: parsed.data.emergencyContactName || null,
      emergency_contact_phone: parsed.data.emergencyContactPhone || null,
      assigned_trainer_id: parsed.data.assignedTrainerId || null,
      joined_at: parsed.data.startDate,
      created_by: context.userId,
      notes: parsed.data.notes || null
    })
    .select("*")
    .maybeSingle();

  if (memberError || !member) {
    return { status: "error", message: memberError?.message ?? "Member onboarding failed." };
  }

  const membership = await createMembershipRecord({
    supabase,
    gymId,
    memberId: member.id,
    plan,
    actorId: context.userId,
    startDate: parsed.data.startDate,
    endDate,
    paymentStatus: parsed.data.paymentStatus,
    discountAmount: parsed.data.discountAmount,
    status: parsed.data.paymentStatus === "pending" ? "pending" : "active",
    source: "manual",
    notes: "Created during member onboarding."
  });

  if (!membership.ok) {
    return { status: "error", message: membership.message };
  }

  const profilePhoto = formData.get("profilePhoto");
  if (profilePhoto instanceof File && profilePhoto.size > 0) {
    const upload = await uploadMemberDocumentFile(supabase, {
      gymId,
      memberId: member.id,
      actorId: context.userId,
      documentType: "profile_photo",
      file: profilePhoto
    });

    if (upload.ok) {
      await supabase.from("members").update({ profile_photo_url: upload.filePath }).eq("id", member.id);
    }
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId,
    action: "member.onboarded",
    entityType: "member",
    entityId: member.id,
    metadata: { memberCode, planId: plan.id }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  redirect(`/admin/members/${member.id}`);
}

export async function assignMembershipAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members");
  const parsed = MembershipAssignmentSchema.safeParse({
    memberId: formData.get("memberId"),
    planId: formData.get("planId"),
    startDate: formData.get("startDate"),
    paymentStatus: formData.get("paymentStatus"),
    discountAmount: formData.get("discountAmount") ?? "0",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const [member, plan] = await Promise.all([
    loadMember(supabase, parsed.data.memberId),
    loadPlan(supabase, parsed.data.planId)
  ]);

  if (!member) {
    return { status: "error", message: "Member not found." };
  }

  if (!plan || plan.status !== "active") {
    return { status: "error", message: "Choose an active membership plan." };
  }

  const endDate = calculateEndDate(parsed.data.startDate, plan.duration_days);
  const dateError = validateMembershipDates(parsed.data.startDate, endDate);

  if (dateError) {
    return { status: "error", message: dateError };
  }

  const result = await createMembershipRecord({
    supabase,
    gymId: member.gym_id,
    memberId: member.id,
    plan,
    actorId: context.userId,
    startDate: parsed.data.startDate,
    endDate,
    paymentStatus: parsed.data.paymentStatus,
    discountAmount: parsed.data.discountAmount,
    status: parsed.data.paymentStatus === "pending" ? "pending" : "active",
    source: "manual",
    notes: parsed.data.notes || null
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/members/${member.id}`);
  revalidatePath("/admin/members");
  return { status: "success", message: "Membership assigned." };
}

export async function renewMembershipAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members");
  const parsed = RenewalSchema.safeParse({
    membershipId: formData.get("membershipId"),
    planId: formData.get("planId"),
    startDate: formData.get("startDate"),
    paymentStatus: formData.get("paymentStatus"),
    discountAmount: formData.get("discountAmount") ?? "0",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const membership = await loadMembership(supabase, parsed.data.membershipId);

  if (!membership) {
    return { status: "error", message: "Membership not found." };
  }

  const renewalError = validateRenewalSource(membership);
  if (renewalError) {
    return { status: "error", message: renewalError };
  }

  const plan = await loadPlan(supabase, parsed.data.planId);

  if (!plan || plan.status !== "active") {
    return { status: "error", message: "Choose an active renewal plan." };
  }

  const startDate = parsed.data.startDate;
  const endDate = calculateEndDate(startDate, plan.duration_days);
  const dateError = validateMembershipDates(startDate, endDate);

  if (dateError) {
    return { status: "error", message: dateError };
  }

  const previousEndDate = membership.end_date;
  const renewalDiscountAmount = normalizeMembershipDiscount(parsed.data.paymentStatus, parsed.data.discountAmount, plan.price_amount);
  const { data: updatedMembership, error } = await supabase
    .from("memberships")
    .update({
      membership_plan_id: plan.id,
      status: parsed.data.paymentStatus === "pending" ? "pending" : "active",
      start_date: startDate,
      end_date: endDate,
      price_amount: plan.price_amount,
      joining_fee_amount: 0,
      discount_amount: renewalDiscountAmount,
      payment_status: parsed.data.paymentStatus,
      renewal_of_membership_id: membership.id,
      updated_by: context.userId,
      notes: parsed.data.notes || membership.notes
    })
    .eq("id", membership.id)
    .select("*")
    .maybeSingle();

  if (error || !updatedMembership) {
    return { status: "error", message: error?.message ?? "Membership renewal failed." };
  }

  const billing = await createMembershipBillingRecords({
    supabase,
    gymId: membership.gym_id,
    memberId: membership.member_id,
    membership: updatedMembership,
    planName: plan.name,
    actorId: context.userId,
    paymentType: "membership_renewal",
    billingEventType: "membership_renewed"
  });

  if (!billing.ok) {
    return { status: "error", message: billing.message };
  }

  await Promise.all([
    insertHistory(supabase, {
      gymId: membership.gym_id,
      membershipId: membership.id,
      memberId: membership.member_id,
      event: "renewed",
      fromPlanId: membership.membership_plan_id,
      toPlanId: plan.id,
      fromStatus: membership.status,
      toStatus: parsed.data.paymentStatus === "pending" ? "pending" : "active",
      previousStartDate: membership.start_date,
      previousEndDate,
      newStartDate: startDate,
      newEndDate: endDate,
      reason: parsed.data.notes || "Manual renewal",
      actorId: context.userId
    }),
    insertStatusLog(supabase, membership, parsed.data.paymentStatus === "pending" ? "pending" : "active", parsed.data.notes || "Renewed", context.userId),
    writeAuditLog({
      actorId: context.userId,
      gymId: membership.gym_id,
      action: "membership.renewed",
      entityType: "membership",
      entityId: membership.id,
      metadata: { planId: plan.id, previousEndDate, endDate }
    })
  ]);

  revalidatePath(`/admin/members/${membership.member_id}`);
  revalidatePath("/admin");
  return { status: "success", message: "Membership renewed." };
}

export async function changeMembershipPlanAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members");
  const parsed = PlanChangeSchema.safeParse({
    membershipId: formData.get("membershipId"),
    planId: formData.get("planId"),
    reason: formData.get("reason")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const membership = await loadMembership(supabase, parsed.data.membershipId);

  if (!membership) {
    return { status: "error", message: "Membership not found." };
  }

  if (membership.status === "cancelled" || membership.status === "expired") {
    return { status: "error", message: "Only open memberships can change plan." };
  }

  const [currentPlan, nextPlan] = await Promise.all([
    loadPlan(supabase, membership.membership_plan_id),
    loadPlan(supabase, parsed.data.planId)
  ]);

  if (!currentPlan || !nextPlan || nextPlan.status !== "active") {
    return { status: "error", message: "Plan change requires an active target plan." };
  }

  const event = classifyPlanChange(currentPlan, nextPlan);
  const { error } = await supabase
    .from("memberships")
    .update({
      membership_plan_id: nextPlan.id,
      price_amount: nextPlan.price_amount,
      joining_fee_amount: nextPlan.joining_fee_amount,
      updated_by: context.userId
    })
    .eq("id", membership.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  await Promise.all([
    insertHistory(supabase, {
      gymId: membership.gym_id,
      membershipId: membership.id,
      memberId: membership.member_id,
      event,
      fromPlanId: currentPlan.id,
      toPlanId: nextPlan.id,
      reason: parsed.data.reason,
      actorId: context.userId
    }),
    writeAuditLog({
      actorId: context.userId,
      gymId: membership.gym_id,
      action: `membership.${event}`,
      entityType: "membership",
      entityId: membership.id,
      metadata: { fromPlanId: currentPlan.id, toPlanId: nextPlan.id }
    })
  ]);

  revalidatePath(`/admin/members/${membership.member_id}`);
  return { status: "success", message: "Membership plan changed." };
}

export async function changeMembershipStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members");
  const parsed = StatusChangeSchema.safeParse({
    membershipId: formData.get("membershipId"),
    nextStatus: formData.get("nextStatus"),
    reason: formData.get("reason")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const membership = await loadMembership(supabase, parsed.data.membershipId);

  if (!membership) {
    return { status: "error", message: "Membership not found." };
  }

  const transitionError = validateStatusTransition(membership.status, parsed.data.nextStatus);
  if (transitionError) {
    return { status: "error", message: transitionError };
  }

  const timestampUpdates = membershipTimestampUpdate(parsed.data.nextStatus);
  const { error } = await supabase
    .from("memberships")
    .update({
      status: parsed.data.nextStatus,
      updated_by: context.userId,
      ...timestampUpdates
    })
    .eq("id", membership.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  const event = statusToEvent(parsed.data.nextStatus);
  await Promise.all([
    insertStatusLog(supabase, membership, parsed.data.nextStatus, parsed.data.reason, context.userId),
    insertHistory(supabase, {
      gymId: membership.gym_id,
      membershipId: membership.id,
      memberId: membership.member_id,
      event,
      fromStatus: membership.status,
      toStatus: parsed.data.nextStatus,
      reason: parsed.data.reason,
      actorId: context.userId
    }),
    writeAuditLog({
      actorId: context.userId,
      gymId: membership.gym_id,
      action: `membership.${event}`,
      entityType: "membership",
      entityId: membership.id,
      metadata: { fromStatus: membership.status, toStatus: parsed.data.nextStatus }
    })
  ]);

  revalidatePath(`/admin/members/${membership.member_id}`);
  revalidatePath("/admin");
  return { status: "success", message: "Membership status updated." };
}

export async function uploadMemberDocumentAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members");
  const parsed = DocumentUploadSchema.safeParse({
    memberId: formData.get("memberId"),
    documentType: formData.get("documentType")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const file = formData.get("documentFile");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a document to upload." };
  }

  const supabase = await createSupabaseServerClient();
  const member = await loadMember(supabase, parsed.data.memberId);

  if (!member) {
    return { status: "error", message: "Member not found." };
  }

  const upload = await uploadMemberDocumentFile(supabase, {
    gymId: member.gym_id,
    memberId: member.id,
    actorId: context.userId,
    documentType: parsed.data.documentType,
    file
  });

  if (!upload.ok) {
    return { status: "error", message: upload.message };
  }

  if (parsed.data.documentType === "profile_photo") {
    await supabase.from("members").update({ profile_photo_url: upload.filePath }).eq("id", member.id);
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: member.gym_id,
    action: "member_document.uploaded",
    entityType: "member_document",
    entityId: upload.documentId,
    metadata: { memberId: member.id, documentType: parsed.data.documentType }
  });

  revalidatePath(`/admin/members/${member.id}`);
  return { status: "success", message: "Document uploaded." };
}

export async function deleteMemberDocumentAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members");
  const documentId = String(formData.get("documentId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");

  if (!documentId || !memberId) {
    return { status: "error", message: "Invalid document." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: document, error: documentError } = await supabase.from("member_documents").select("*").eq("id", documentId).maybeSingle();

  if (documentError || !document) {
    return { status: "error", message: "Document not found." };
  }

  await supabase.storage.from("member-documents").remove([document.file_path]);
  const { error } = await supabase.from("member_documents").delete().eq("id", document.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: document.gym_id,
    action: "member_document.deleted",
    entityType: "member_document",
    entityId: document.id,
    metadata: { memberId: document.member_id }
  });

  revalidatePath(`/admin/members/${memberId}`);
  return { status: "success", message: "Document deleted." };
}

export async function expireMembershipsAction(): Promise<AuthActionState> {
  const context = await requireRole(["super_admin", "gym_admin"], "/admin");
  const supabase = await createSupabaseServerClient();
  const today = formatISO(new Date(), { representation: "date" });
  const query = supabase
    .from("memberships")
    .select("*")
    .eq("status", "active")
    .lt("end_date", today);

  if (context.profile?.gym_id) {
    query.eq("gym_id", context.profile.gym_id);
  }

  const { data: memberships, error } = await query;

  if (error) {
    return { status: "error", message: error.message };
  }

  const rows = memberships ?? [];

  for (const membership of rows) {
    await supabase.from("memberships").update({ status: "expired", updated_by: context.userId }).eq("id", membership.id);
    await insertStatusLog(supabase, membership, "expired", "Automated expiry processing", context.userId);
    await insertHistory(supabase, {
      gymId: membership.gym_id,
      membershipId: membership.id,
      memberId: membership.member_id,
      event: "expired",
      fromStatus: membership.status,
      toStatus: "expired",
      reason: "Automated expiry processing",
      actorId: context.userId
    });
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "membership.expiry_processed",
    entityType: "membership",
    metadata: { count: rows.length }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  return { status: "success", message: `${rows.length} memberships marked expired.` };
}

export async function expireMembershipsFormAction(formData: FormData): Promise<void> {
  void formData;
  await expireMembershipsAction();
}

async function createMembershipRecord(input: {
  supabase: SupabaseClient<Database>;
  gymId: string | null;
  memberId: string;
  plan: MembershipPlanRow;
  actorId: string | null;
  startDate: string;
  endDate: string;
  paymentStatus: MembershipRow["payment_status"];
  discountAmount: number;
  status: MembershipStatus;
  source: MembershipRow["source"];
  notes: string | null;
  paymentType?: PaymentType;
  billingEventType?: BillingEventType;
}) {
  const discountAmount = normalizeMembershipDiscount(
    input.paymentStatus,
    input.discountAmount,
    input.plan.price_amount + input.plan.joining_fee_amount
  );

  const { data, error } = await input.supabase
    .from("memberships")
    .insert({
      gym_id: input.gymId,
      member_id: input.memberId,
      membership_plan_id: input.plan.id,
      status: input.status,
      start_date: input.startDate,
      end_date: input.endDate,
      activated_at: input.status === "active" ? new Date().toISOString() : null,
      source: input.source,
      price_amount: input.plan.price_amount,
      joining_fee_amount: input.plan.joining_fee_amount,
      discount_amount: discountAmount,
      payment_status: input.paymentStatus,
      invoice_number: generateInvoiceNumber(),
      notes: input.notes,
      created_by: input.actorId,
      updated_by: input.actorId
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, message: "This member already has an open membership. Renew, cancel, or expire it before assigning another." } as const;
    }

    return { ok: false, message: error?.message ?? "Membership assignment failed." } as const;
  }

  const billing = await createMembershipBillingRecords({
    supabase: input.supabase,
    gymId: input.gymId,
    memberId: input.memberId,
    membership: data,
    planName: input.plan.name,
    actorId: input.actorId,
    paymentType: input.paymentType ?? "membership_purchase",
    billingEventType: input.billingEventType ?? "membership_created"
  });

  if (!billing.ok) {
    return { ok: false, message: billing.message } as const;
  }

  await Promise.all([
    insertHistory(input.supabase, {
      gymId: input.gymId,
      membershipId: data.id,
      memberId: input.memberId,
      event: "created",
      toPlanId: input.plan.id,
      toStatus: data.status,
      newStartDate: input.startDate,
      newEndDate: input.endDate,
      reason: input.notes,
      actorId: input.actorId
    }),
    insertStatusLog(input.supabase, data, data.status, "Membership created", input.actorId),
    input.supabase.from("membership_notification_events").insert({
      gym_id: input.gymId,
      membership_id: data.id,
      member_id: input.memberId,
      event_type: "membership_created",
      channel: "system",
      status: "queued",
      metadata: { planId: input.plan.id }
    }),
    writeAuditLog({
      actorId: input.actorId,
      gymId: input.gymId,
      action: "membership.created",
      entityType: "membership",
      entityId: data.id,
      metadata: { memberId: input.memberId, planId: input.plan.id }
    })
  ]);

  return { ok: true, membership: data } as const;
}

async function createMembershipBillingRecords(input: {
  supabase: SupabaseClient<Database>;
  gymId: string | null;
  memberId: string;
  membership: MembershipRow;
  planName: string;
  actorId: string | null;
  paymentType: PaymentType;
  billingEventType: BillingEventType;
}) {
  const billingClient = getSupabaseAdminClient() ?? input.supabase;
  const subtotalAmount = input.membership.price_amount + input.membership.joining_fee_amount;
  const discountAmount = Math.min(input.membership.discount_amount, subtotalAmount);
  const totalAmount = Math.max(subtotalAmount - discountAmount, 0);
  const now = new Date().toISOString();
  const invoiceNumber = await generateBillingInvoiceNumber(billingClient, input.gymId);
  const isSettled = input.membership.payment_status === "paid" || input.membership.payment_status === "waived" || totalAmount === 0;
  const invoiceStatus = isSettled ? "paid" : "issued";

  const { data: invoice, error: invoiceError } = await billingClient
    .from("invoices")
    .insert({
      gym_id: input.gymId,
      member_id: input.memberId,
      membership_id: input.membership.id,
      invoice_number: invoiceNumber,
      status: invoiceStatus,
      currency: "INR",
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      tax_amount: 0,
      amount_paid: isSettled ? totalAmount : 0,
      issued_at: now,
      paid_at: isSettled ? now : null,
      notes: `${input.planName} membership ${input.paymentType === "membership_renewal" ? "renewal" : "purchase"}.`,
      created_by: input.actorId
    })
    .select("*")
    .maybeSingle();

  if (invoiceError || !invoice) {
    return { ok: false, message: invoiceError?.message ?? "Invoice generation failed." } as const;
  }

  const { error: itemError } = await billingClient.from("invoice_items").insert({
    invoice_id: invoice.id,
    item_type: "membership",
    description: `${input.planName} membership`,
    quantity: 1,
    unit_amount: subtotalAmount,
    discount_amount: discountAmount,
    tax_amount: 0,
    metadata: {
      membershipId: input.membership.id,
      planId: input.membership.membership_plan_id,
      joiningFeeAmount: input.membership.joining_fee_amount
    } as Json
  });

  if (itemError) {
    return { ok: false, message: itemError.message } as const;
  }

  await input.supabase
    .from("memberships")
    .update({ invoice_number: invoiceNumber, updated_by: input.actorId })
    .eq("id", input.membership.id);

  await billingClient.from("transactions").insert({
    gym_id: input.gymId,
    member_id: input.memberId,
    invoice_id: invoice.id,
    transaction_type: "invoice_created",
    direction: "debit",
    amount: totalAmount,
    currency: "INR",
    description: `Invoice ${invoiceNumber} generated for ${input.planName}.`,
    metadata: { membershipId: input.membership.id, paymentType: input.paymentType } as Json,
    created_by: input.actorId
  });

  await billingClient.from("billing_events").insert({
    gym_id: input.gymId,
    event_type: "invoice_generated",
    entity_type: "invoice",
    entity_id: invoice.id,
    status: "recorded",
    metadata: {
      membershipId: input.membership.id,
      invoiceNumber,
      billingEventType: input.billingEventType
    } as Json
  });

  await billingClient.from("billing_events").insert({
    gym_id: input.gymId,
    event_type: input.billingEventType,
    entity_type: "membership",
    entity_id: input.membership.id,
    status: "recorded",
    metadata: { invoiceId: invoice.id, invoiceNumber, totalAmount } as Json
  });

  if (totalAmount <= 0 || input.membership.payment_status === "waived") {
    return { ok: true, invoiceId: invoice.id, paymentId: null } as const;
  }

  const isPaid = input.membership.payment_status === "paid";
  const paymentNumber = await generatePaymentNumber(billingClient, input.gymId);
  const { data: payment, error: paymentError } = await billingClient
    .from("payments")
    .insert({
      gym_id: input.gymId,
      member_id: input.memberId,
      membership_id: input.membership.id,
      invoice_id: invoice.id,
      payment_number: paymentNumber,
      payment_type: input.paymentType,
      status: isPaid ? "paid" : "pending",
      method: isPaid ? "cash" : "razorpay",
      provider: isPaid ? "manual" : "razorpay",
      amount: totalAmount,
      currency: "INR",
      discount_amount: discountAmount,
      tax_amount: 0,
      receipt_number: isPaid ? `RCPT-${paymentNumber.replace(/^PAY-/, "")}` : null,
      collected_at: isPaid ? now : null,
      paid_at: isPaid ? now : null,
      metadata: {
        membershipId: input.membership.id,
        invoiceId: invoice.id,
        source: isPaid ? "manual_membership_collection" : "membership_online_payment"
      } as Json,
      created_by: input.actorId
    })
    .select("id")
    .maybeSingle();

  if (paymentError || !payment) {
    return { ok: false, message: paymentError?.message ?? "Payment record generation failed." } as const;
  }

  if (isPaid) {
    await Promise.all([
      billingClient.from("transactions").insert({
        gym_id: input.gymId,
        member_id: input.memberId,
        invoice_id: invoice.id,
        payment_id: payment.id,
        transaction_type: "payment_collected",
        direction: "credit",
        amount: totalAmount,
        currency: "INR",
        description: `Payment collected for invoice ${invoiceNumber}.`,
        metadata: { membershipId: input.membership.id, method: "cash" } as Json,
        created_by: input.actorId
      }),
      billingClient.from("billing_events").insert({
        gym_id: input.gymId,
        event_type: "payment_completed",
        entity_type: "payment",
        entity_id: payment.id,
        status: "recorded",
        metadata: { invoiceId: invoice.id, membershipId: input.membership.id } as Json
      })
    ]);
  }

  return { ok: true, invoiceId: invoice.id, paymentId: payment.id } as const;
}

async function loadPlan(supabase: SupabaseClient<Database>, planId: string) {
  const { data, error } = await supabase.from("membership_plans").select("*").eq("id", planId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadMember(supabase: SupabaseClient<Database>, memberId: string) {
  const { data, error } = await supabase.from("members").select("*").eq("id", memberId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadMembership(supabase: SupabaseClient<Database>, membershipId: string) {
  const { data, error } = await supabase.from("memberships").select("*").eq("id", membershipId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function generateMemberCode(supabase: SupabaseClient<Database>, gymId: string | null) {
  const { data, error } = await supabase.rpc("generate_member_code", { target_gym_id: gymId });

  if (error || !data) {
    return `APX-${Date.now().toString().slice(-5)}`;
  }

  return data;
}

async function uploadMemberDocumentFile(
  supabase: SupabaseClient<Database>,
  input: {
    gymId: string | null;
    memberId: string;
    actorId: string | null;
    documentType: MemberDocumentType;
    file: File;
  }
) {
  if (!memberDocumentMimeTypes.has(input.file.type)) {
    return { ok: false, message: "Upload a JPG, PNG, WebP, or PDF document." } as const;
  }

  if (input.file.size > maxMemberDocumentBytes) {
    return { ok: false, message: "Document must be under 10 MB." } as const;
  }

  const validation = await validateAllowedFile(input.file, memberDocumentMimeTypes, "Upload a valid JPG, PNG, WebP, or PDF document.");
  if (!validation.ok) {
    return { ok: false, message: validation.message } as const;
  }

  const extension = validation.extension;
  const path = `${input.memberId}/${input.documentType}-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("member-documents").upload(path, input.file, {
    cacheControl: "3600",
    contentType: validation.mimeType,
    upsert: true
  });

  if (uploadError) {
    return { ok: false, message: uploadError.message } as const;
  }

  const { data, error } = await supabase
    .from("member_documents")
    .insert({
      gym_id: input.gymId,
      member_id: input.memberId,
      document_type: input.documentType,
      file_name: input.file.name,
      file_path: path,
      file_url: path,
      mime_type: validation.mimeType,
      file_size: input.file.size,
      uploaded_by: input.actorId
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Document metadata could not be saved." } as const;
  }

  return { ok: true, documentId: data.id, filePath: path } as const;
}

async function insertHistory(
  supabase: SupabaseClient<Database>,
  input: {
    gymId: string | null;
    membershipId: string;
    memberId: string;
    event: MembershipEvent;
    fromPlanId?: string | null;
    toPlanId?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    previousStartDate?: string | null;
    previousEndDate?: string | null;
    newStartDate?: string | null;
    newEndDate?: string | null;
    reason?: string | null;
    actorId: string | null;
  }
) {
  await supabase.from("membership_history").insert({
    gym_id: input.gymId,
    membership_id: input.membershipId,
    member_id: input.memberId,
    event: input.event,
    from_plan_id: input.fromPlanId ?? null,
    to_plan_id: input.toPlanId ?? null,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    previous_start_date: input.previousStartDate ?? null,
    previous_end_date: input.previousEndDate ?? null,
    new_start_date: input.newStartDate ?? null,
    new_end_date: input.newEndDate ?? null,
    reason: input.reason ?? null,
    created_by: input.actorId
  });
}

async function insertStatusLog(
  supabase: SupabaseClient<Database>,
  membership: MembershipRow,
  nextStatus: MembershipStatus,
  reason: string,
  actorId: string | null
) {
  await supabase.from("membership_status_logs").insert({
    gym_id: membership.gym_id,
    membership_id: membership.id,
    member_id: membership.member_id,
    from_status: membership.status,
    to_status: nextStatus,
    reason,
    created_by: actorId
  });
}

function readFeatureQuantities(formData: FormData) {
  return Object.fromEntries(
    planFeatureCatalog.map((feature) => {
      const raw = formData.get(`featureQuantity:${feature.key}`);
      const value = typeof raw === "string" && raw ? Number(raw) : null;
      return [feature.key, Number.isFinite(value) ? value : null];
    })
  );
}

function membershipTimestampUpdate(status: MembershipStatus) {
  const now = new Date().toISOString();

  if (status === "active") {
    return { activated_at: now };
  }

  if (status === "cancelled") {
    return { cancelled_at: now };
  }

  if (status === "frozen") {
    return { frozen_at: now };
  }

  if (status === "suspended") {
    return { suspended_at: now };
  }

  return {};
}

function statusToEvent(status: MembershipStatus): MembershipEvent {
  if (status === "active") {
    return "reactivated";
  }

  if (status === "frozen") {
    return "frozen";
  }

  if (status === "suspended") {
    return "suspended";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "expired";
}

function normalizeMembershipDiscount(paymentStatus: MembershipRow["payment_status"], discountAmount: number, subtotalAmount: number) {
  if (paymentStatus === "waived") {
    return Math.max(subtotalAmount, 0);
  }

  return Math.min(Math.max(discountAmount, 0), Math.max(subtotalAmount, 0));
}

async function generateBillingInvoiceNumber(supabase: SupabaseClient<Database>, gymId: string | null) {
  const { data, error } = await supabase.rpc("generate_invoice_number", { target_gym_id: gymId });

  if (error || !data) {
    return generateInvoiceNumber();
  }

  return data;
}

async function generatePaymentNumber(supabase: SupabaseClient<Database>, gymId: string | null) {
  const { data, error } = await supabase.rpc("generate_payment_number", { target_gym_id: gymId });

  if (error || !data) {
    return `PAY-${formatISO(new Date(), { representation: "date" }).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
  }

  return data;
}

function generateInvoiceNumber() {
  return `INV-${formatISO(new Date(), { representation: "date" }).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
}

function validationState(fieldErrors: Record<string, string[]>): AuthActionState {
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors
  };
}

export async function suggestedRenewalStartDateAction(membershipId: string) {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/members");
  const supabase = await createSupabaseServerClient();
  const membership = await loadMembership(supabase, membershipId);

  if (!membership || (context.profile?.gym_id && membership.gym_id !== context.profile.gym_id)) {
    return formatDateInput(new Date());
  }

  return formatDateInput(addDays(parseISO(membership.end_date), 1));
}
