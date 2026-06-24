"use server";

import { addDays, formatISO, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { requireGymFrontDeskScope } from "@/features/reception/lib/access";
import { validateAllowedFile } from "@/lib/security/file-validation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isWithinMemberLimit } from "@/lib/tenant";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database, Json } from "@/types/database";
import type { AuthContext } from "@/types/auth";
import {
  entitlementSimpleCatch,
  requireOrganizationFeatureAccess,
  type FeatureKey,
} from "@/features/entitlement";
import { applySplitRules } from "@/features/organization-owner/actions/revenue-split-actions";
import { autoEarnReferralRewardsForMember } from "@/features/organization-owner/actions/referral-actions";
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
  const scope = await requireGymAdminScope("/admin/membership-plans");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "membership_plan.save");
  if (entitlementError) return entitlementError;
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
  const gymId = scope.gymId;
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
    created_by: scope.userId
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
    actorId: scope.userId,
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
  const scope = await requireGymAdminScope("/admin/membership-plans");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "membership_plan.status.update");
  if (entitlementError) return entitlementError;
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
    .eq("id", planId)
    .eq("gym_id", scope.gymId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    action: "membership_plan.status_changed",
    entityType: "membership_plan",
    entityId: planId,
    metadata: { status }
  });

  revalidatePath("/admin/membership-plans");
  return { status: "success", message: "Plan status updated." };
}

export async function onboardMemberAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymFrontDeskScope(["super_admin", "gym_admin", "reception_staff"], "/reception/register");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "member.onboard");
  if (entitlementError) return entitlementError;
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
  const gymId = scope.gymId;
  const plan = await loadPlan(supabase, parsed.data.planId);

  if (!plan || plan.gym_id !== gymId || plan.status !== "active") {
    return { status: "error", message: "Choose an active membership plan." };
  }

  const endDate = calculateEndDate(parsed.data.startDate, plan.duration_days);
  const dateError = validateMembershipDates(parsed.data.startDate, endDate);

  if (dateError) {
    return { status: "error", message: dateError };
  }

  const memberLimitError = await requireMemberCapacity(supabase, getContextOrganizationId(scope), gymId);
  if (memberLimitError) {
    return memberLimitError;
  }

  const branchScope = await resolveOperationalBranchScope(supabase, {
    gymId,
    contextBranchId: getContextBranchId(scope),
    existingBranchId: null
  });
  if (!branchScope.ok) {
    return { status: "error", message: branchScope.message };
  }

  const memberCode = await generateMemberCode(supabase, gymId);
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      gym_id: gymId,
      branch_id: branchScope.branchId,
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
      created_by: scope.userId,
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
    branchId: branchScope.branchId,
    memberId: member.id,
    plan,
    actorId: scope.userId,
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
      actorId: scope.userId,
      documentType: "profile_photo",
      file: profilePhoto
    });

    if (upload.ok) {
      await supabase.from("members").update({ profile_photo_url: upload.filePath }).eq("id", member.id);
    }
  }

  await writeAuditLog({
    actorId: scope.userId,
    gymId,
    action: "member.onboarded",
    entityType: "member",
    entityId: member.id,
    metadata: { memberCode, planId: plan.id, branchId: branchScope.branchId }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/reception");
  revalidatePath("/reception/members");
  revalidatePath("/reception/register");

  if (scope.roles.includes("reception_staff") && !scope.roles.includes("gym_admin") && !scope.roles.includes("super_admin")) {
    redirect(`/reception/members?q=${encodeURIComponent(member.phone)}`);
  }

  redirect(`/admin/members/${member.id}`);
}

export async function assignMembershipAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/members");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "membership.assign");
  if (entitlementError) return entitlementError;
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

  if (member.gym_id !== scope.gymId) {
    return { status: "error", message: "Member does not belong to this gym." };
  }

  if (!plan || plan.gym_id !== scope.gymId || plan.status !== "active") {
    return { status: "error", message: "Choose an active membership plan." };
  }

  const branchScope = await resolveOperationalBranchScope(supabase, {
    gymId: member.gym_id,
    contextBranchId: getContextBranchId(scope),
    existingBranchId: member.branch_id
  });
  if (!branchScope.ok) {
    return { status: "error", message: branchScope.message };
  }

  if (!member.branch_id && branchScope.branchId) {
    await supabase.from("members").update({ branch_id: branchScope.branchId }).eq("id", member.id);
  }

  const endDate = calculateEndDate(parsed.data.startDate, plan.duration_days);
  const dateError = validateMembershipDates(parsed.data.startDate, endDate);

  if (dateError) {
    return { status: "error", message: dateError };
  }

  const result = await createMembershipRecord({
    supabase,
    gymId: member.gym_id,
    branchId: branchScope.branchId,
    memberId: member.id,
    plan,
    actorId: scope.userId,
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
  const scope = await requireGymAdminScope("/admin/members");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management", "membership_renewals"], "membership.renew");
  if (entitlementError) return entitlementError;
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

  if (membership.gym_id !== scope.gymId) {
    return { status: "error", message: "Membership does not belong to this gym." };
  }

  const renewalError = validateRenewalSource(membership);
  if (renewalError) {
    return { status: "error", message: renewalError };
  }

  const plan = await loadPlan(supabase, parsed.data.planId);

  if (!plan || plan.gym_id !== scope.gymId || plan.status !== "active") {
    return { status: "error", message: "Choose an active renewal plan." };
  }

  const member = await loadMember(supabase, membership.member_id);
  const branchScope = await resolveOperationalBranchScope(supabase, {
    gymId: membership.gym_id,
    contextBranchId: getContextBranchId(scope),
    existingBranchId: member?.branch_id ?? null
  });
  if (!branchScope.ok) {
    return { status: "error", message: branchScope.message };
  }

  if (member && !member.branch_id && branchScope.branchId) {
    await supabase.from("members").update({ branch_id: branchScope.branchId }).eq("id", member.id);
  }

  const startDate = parsed.data.startDate;
  const endDate = calculateEndDate(startDate, plan.duration_days);
  const dateError = validateMembershipDates(startDate, endDate);

  if (dateError) {
    return { status: "error", message: dateError };
  }

  const previousEndDate = membership.end_date;
  let renewalDiscountAmount = normalizeMembershipDiscount(parsed.data.paymentStatus, parsed.data.discountAmount, plan.price_amount);

  // ─── Loyalty points redemption (Step 6 — points-based renewal discount) ──
  const redeemPointsRaw = formData.get("redeemPoints");
  const redeemPoints = redeemPointsRaw ? Number(redeemPointsRaw) : 0;
  let loyaltyDiscountPaise = 0;
  if (redeemPoints > 0 && membership.gym_id) {
    try {
      const orgId = await getOrganizationIdForGym(supabase, membership.gym_id);
      if (orgId) {
        const { getLoyaltyConfig, redeemPoints: redeemPointsAction } = await import("@/features/organization-owner/actions/loyalty-actions");
        const loyaltyConfig = await getLoyaltyConfig(orgId).catch(() => null);
        if (loyaltyConfig && loyaltyConfig.is_active) {
          const balance = await supabase
            .from("loyalty_points")
            .select("points")
            .eq("member_id", membership.member_id);
          const currentBalance = (balance.data ?? []).reduce((sum: number, r: { points: number }) => sum + r.points, 0);
          if (currentBalance >= redeemPoints && redeemPoints >= loyaltyConfig.min_points_to_redeem) {
            loyaltyDiscountPaise = Math.round(redeemPoints * 100 / loyaltyConfig.points_redemption_rate);
            const subtotal = plan.price_amount;
            const maxRedemptionPaise = Math.floor(subtotal * loyaltyConfig.max_redemption_percentage / 100);
            if (loyaltyDiscountPaise > maxRedemptionPaise) {
              loyaltyDiscountPaise = maxRedemptionPaise;
            }
            if (loyaltyDiscountPaise > 0) {
              renewalDiscountAmount += loyaltyDiscountPaise;
            }
          }
        }
      }
    } catch { /* loyalty redemption validation is best-effort — don't block renewal */ }
  }
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
      updated_by: scope.userId,
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
    branchId: branchScope.branchId,
    memberId: membership.member_id,
    membership: updatedMembership,
    planName: plan.name,
    actorId: scope.userId,
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
      actorId: scope.userId
    }),
    insertStatusLog(supabase, membership, parsed.data.paymentStatus === "pending" ? "pending" : "active", parsed.data.notes || "Renewed", scope.userId),
    writeAuditLog({
      actorId: scope.userId,
      gymId: membership.gym_id,
      action: "membership.renewed",
      entityType: "membership",
      entityId: membership.id,
      metadata: { planId: plan.id, previousEndDate, endDate }
    })
  ]);

  revalidatePath(`/admin/members/${membership.member_id}`);
  revalidatePath("/admin");

  // Auto-earn referral rewards after renewal (membership may now be mature)
  autoEarnReferralRewardsForMember(membership.member_id).catch(() => {});

  // Fire outgoing webhook for membership renewal (never blocks)
  if (membership.gym_id) {
    getOrganizationIdForGym(supabase, membership.gym_id).then((orgId) => {
      if (orgId) {
        import("@/features/webhooks/trigger").then(({ triggerWebhook }) =>
          triggerWebhook(orgId, "membership.renewed", {
            memberId: membership.member_id,
            membershipId: membership.id,
            planId: plan.id,
            planName: plan.name,
          }).catch(() => {})
        ).catch(() => {});
      }
    }).catch(() => {});
  }

  // Award loyalty points for renewal (fire and forget)
  if (membership.gym_id) {
    getOrganizationIdForGym(supabase, membership.gym_id).then((orgId) => {
      if (orgId) {
        const subtotal = updatedMembership.price_amount + updatedMembership.joining_fee_amount;
        const discount = Math.min(updatedMembership.discount_amount, subtotal);
        const paymentAmount = Math.max(subtotal - discount, 0);
        if (paymentAmount > 0) {
          import("@/features/organization-owner/actions/loyalty-actions").then(({ earnPoints }) =>
            earnPoints(orgId, membership.member_id, "renewal", membership.id, `Membership renewal`, paymentAmount).catch(() => {})
          ).catch(() => {});
        }
        // Record loyalty redemption if points were redeemed during this renewal
        if (loyaltyDiscountPaise > 0 && billing.invoiceId) {
          import("@/features/organization-owner/actions/loyalty-actions").then(({ redeemPoints: redeemPointsAction }) =>
            redeemPointsAction(orgId, membership.member_id, redeemPoints, billing.invoiceId!, `Renewal discount (${redeemPoints} pts)`)
              .catch(() => {})
          ).catch(() => {});
        }
      }
    }).catch(() => {});
  }

  return { status: "success", message: "Membership renewed." };
}

export async function changeMembershipPlanAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/members");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "membership.plan.change");
  if (entitlementError) return entitlementError;
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

  if (membership.gym_id !== scope.gymId) {
    return { status: "error", message: "Membership does not belong to this gym." };
  }

  if (membership.status === "cancelled" || membership.status === "expired") {
    return { status: "error", message: "Only open memberships can change plan." };
  }

  const [currentPlan, nextPlan] = await Promise.all([
    loadPlan(supabase, membership.membership_plan_id),
    loadPlan(supabase, parsed.data.planId)
  ]);

  if (!currentPlan || !nextPlan || currentPlan.gym_id !== scope.gymId || nextPlan.gym_id !== scope.gymId || nextPlan.status !== "active") {
    return { status: "error", message: "Plan change requires an active target plan." };
  }

  const event = classifyPlanChange(currentPlan, nextPlan);
  const { error } = await supabase
    .from("memberships")
    .update({
      membership_plan_id: nextPlan.id,
      price_amount: nextPlan.price_amount,
      joining_fee_amount: nextPlan.joining_fee_amount,
      updated_by: scope.userId
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
      actorId: scope.userId
    }),
    writeAuditLog({
      actorId: scope.userId,
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
  const scope = await requireGymAdminScope("/admin/members");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "membership.status.change");
  if (entitlementError) return entitlementError;
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

  if (membership.gym_id !== scope.gymId) {
    return { status: "error", message: "Membership does not belong to this gym." };
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
      updated_by: scope.userId,
      ...timestampUpdates
    })
    .eq("id", membership.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  const event = statusToEvent(parsed.data.nextStatus);
  await Promise.all([
    insertStatusLog(supabase, membership, parsed.data.nextStatus, parsed.data.reason, scope.userId),
    insertHistory(supabase, {
      gymId: membership.gym_id,
      membershipId: membership.id,
      memberId: membership.member_id,
      event,
      fromStatus: membership.status,
      toStatus: parsed.data.nextStatus,
      reason: parsed.data.reason,
      actorId: scope.userId
    }),
    writeAuditLog({
      actorId: scope.userId,
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
  const scope = await requireGymAdminScope("/admin/members");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "member.document.upload");
  if (entitlementError) return entitlementError;
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

  if (member.gym_id !== scope.gymId) {
    return { status: "error", message: "Member does not belong to this gym." };
  }

  const upload = await uploadMemberDocumentFile(supabase, {
    gymId: member.gym_id,
    memberId: member.id,
    actorId: scope.userId,
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
    actorId: scope.userId,
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
  const scope = await requireGymAdminScope("/admin/members");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management"], "member.document.delete");
  if (entitlementError) return entitlementError;
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

  if (document.gym_id !== scope.gymId) {
    return { status: "error", message: "Document does not belong to this gym." };
  }

  await supabase.storage.from("member-documents").remove([document.file_path]);
  const { error } = await supabase.from("member_documents").delete().eq("id", document.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({
    actorId: scope.userId,
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
  const scope = await requireGymAdminScope("/admin");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management", "expiry_tracking"], "membership.expire");
  if (entitlementError) return entitlementError;
  const supabase = await createSupabaseServerClient();
  const today = formatISO(new Date(), { representation: "date" });
  const query = supabase
    .from("memberships")
    .select("*")
    .eq("status", "active")
    .lt("end_date", today);

  query.eq("gym_id", scope.gymId);

  const { data: memberships, error } = await query;

  if (error) {
    return { status: "error", message: error.message };
  }

  const rows = memberships ?? [];

  for (const membership of rows) {
    await supabase.from("memberships").update({ status: "expired", updated_by: scope.userId }).eq("id", membership.id);
    await insertStatusLog(supabase, membership, "expired", "Automated expiry processing", scope.userId);
    await insertHistory(supabase, {
      gymId: membership.gym_id,
      membershipId: membership.id,
      memberId: membership.member_id,
      event: "expired",
      fromStatus: membership.status,
      toStatus: "expired",
      reason: "Automated expiry processing",
      actorId: scope.userId
    });
  }

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
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
  branchId: string | null;
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
    branchId: input.branchId,
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

  // Auto-earn referral rewards if member was referred and membership is mature
  autoEarnReferralRewardsForMember(input.memberId).catch(() => {});

  return { ok: true, membership: data } as const;
}

async function createMembershipBillingRecords(input: {
  supabase: SupabaseClient<Database>;
  gymId: string | null;
  branchId: string | null;
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
      branch_id: input.branchId,
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
      branch_id: input.branchId,
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

  const orgId = await getOrganizationIdForGym(input.supabase, input.gymId);
  if (orgId && payment.id) {
    applySplitRules(orgId, payment.id, totalAmount, input.gymId).catch(() => undefined);
    // Fire outgoing webhook for payment received (never blocks)
    import("@/features/webhooks/trigger").then(({ triggerWebhook }) =>
      triggerWebhook(orgId, "payment.received", {
        memberId: input.memberId,
        membershipId: input.membership.id,
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: totalAmount,
        planName: input.planName,
      }).catch(() => {})
    ).catch(() => {});
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

function getContextOrganizationId(context: AuthContext) {
  return (context as AuthContext & { scopedOrganizationId?: string | null }).scopedOrganizationId ?? context.organizationId ?? null;
}

function getContextBranchId(context: AuthContext) {
  return (context as AuthContext & { branchId?: string | null }).branchId ?? null;
}

async function resolveOperationalBranchScope(
  supabase: SupabaseClient<Database>,
  input: {
    gymId: string | null;
    contextBranchId: string | null;
    existingBranchId: string | null;
  }
): Promise<{ ok: true; branchId: string } | { ok: false; message: string }> {
  if (!input.gymId) {
    return { ok: false, message: "A gym scope is required before member operations can be recorded." };
  }

  const preferredBranchId = input.existingBranchId ?? input.contextBranchId;
  if (preferredBranchId) {
    const { data, error } = await supabase
      .from("branches")
      .select("id, gym_id, status")
      .eq("id", preferredBranchId)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data || data.gym_id !== input.gymId || data.status === "archived") {
      return { ok: false, message: "Selected branch is not active for this gym. Choose a valid branch before recording member operations." };
    }

    return { ok: true, branchId: data.id };
  }

  const { data: branches, error } = await supabase
    .from("branches")
    .select("id, status")
    .eq("gym_id", input.gymId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!branches || branches.length === 0) {
    return { ok: false, message: "Create a branch under this gym before recording members, memberships, or payments." };
  }

  if (branches.length > 1) {
    return { ok: false, message: "Select a branch context before recording this operation. This gym has multiple active branches." };
  }

  const branch = branches[0];
  if (!branch) {
    return { ok: false, message: "Create a branch under this gym before recording members, memberships, or payments." };
  }

  return { ok: true, branchId: branch.id };
}

async function requireMemberCapacity(supabase: SupabaseClient<Database>, organizationId: string | null, gymId: string | null): Promise<AuthActionState | null> {
  try {
    const resolvedOrganizationId = organizationId ?? await getOrganizationIdForGym(supabase, gymId);
    if (!resolvedOrganizationId) {
      return { status: "error", message: "Member limit reached for your current plan. Please upgrade to add more members." };
    }

    const currentMemberCount = await getActiveMemberCountForOrganization(supabase, resolvedOrganizationId);
    const withinLimit = await isWithinMemberLimit(resolvedOrganizationId, currentMemberCount);
    if (!withinLimit) {
      return { status: "error", message: "Member limit reached for your current plan. Please upgrade to add more members." };
    }

    return null;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Member limit reached for your current plan. Please upgrade to add more members." };
  }
}

async function getOrganizationIdForGym(supabase: SupabaseClient<Database>, gymId: string | null) {
  if (!gymId) {
    return null;
  }

  const { data, error } = await supabase.from("gyms").select("organization_id").eq("id", gymId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return data?.organization_id ?? null;
}

async function getActiveMemberCountForOrganization(supabase: SupabaseClient<Database>, organizationId: string) {
  const { data: gyms, error: gymError } = await supabase.from("gyms").select("id").eq("organization_id", organizationId);
  if (gymError) {
    throw new Error(gymError.message);
  }

  const gymIds = (gyms ?? []).map((gym) => gym.id);
  if (gymIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .in("gym_id", gymIds)
    .eq("status", "active");
  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
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
  const scope = await requireGymAdminScope("/admin/members");
  const entitlementError = await requireMembershipFeatures(scope, ["member_management", "membership_renewals"], "membership.renewal_date.read");
  if (entitlementError) return formatDateInput(new Date());
  const supabase = await createSupabaseServerClient();
  const membership = await loadMembership(supabase, membershipId);

  if (!membership || membership.gym_id !== scope.gymId) {
    return formatDateInput(new Date());
  }

  return formatDateInput(addDays(parseISO(membership.end_date), 1));
}

async function requireMembershipFeatures(
  context: AuthContext & { scopedOrganizationId?: string | null },
  featureKeys: readonly FeatureKey[],
  actionName: string,
): Promise<AuthActionState | null> {
  const organizationId = context.scopedOrganizationId ?? context.organizationId;
  if (!organizationId) return { status: "error", message: "Organization scope could not be resolved." };
  try {
    await requireOrganizationFeatureAccess({ organizationId, featureKey: featureKeys, actionName });
    return null;
  } catch (error) {
    return entitlementSimpleCatch(error, "Membership feature access could not be verified.") as AuthActionState;
  }
}
