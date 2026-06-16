"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderBrandedEmail } from "@/emails/auth";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/services/email/resend";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Database, Json } from "@/types/database";
import { normalizeDomain, parseCsvList, slugifyEnterpriseName } from "@/features/enterprise/lib/business-rules";
import {
  buildOrganizationDiff,
  buildOrganizationSnapshot,
  getOrganizationLegalHoldState,
  getOrganizationPurgeEligibility,
  getOrganizationSoftDeleteState,
  isMfaFreshEnough,
  isRestoreWindowOpen,
  mergeLegalHoldSettings,
  mergePermanentPurgeRequestedSettings,
  mergeRestoredOrganizationSettings,
  mergeSoftDeleteSettings,
  type OrganizationGovernanceSnapshot
} from "@/features/super-admin/lib/organization-governance";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import {
  bulkOrganizationActionSchema,
  organizationLegalHoldActionSchema,
  organizationLifecycleActionSchema,
  reviewOrganizationApprovalSchema,
  saveSuperAdminOrganizationSchema,
  transferOrganizationOwnerSchema
} from "../schemas/organization-schemas";

const superAdminRoles = ["super_admin"] as const;
const criticalMfaFreshnessCookieName = "super_admin_mfa_verified_at";
const restoreWindowDays = 30;

type OrganizationMinimalRow = Pick<Database["public"]["Tables"]["organizations"]["Row"], "id" | "name" | "slug" | "status" | "settings" | "owner_user_id" | "organization_type" | "primary_domain" | "billing_email">;
type NotificationProfile = { full_name: string; email: string | null };
type ApprovalAction = "transfer_owner" | "suspend" | "delete" | "bulk_suspend" | "bulk_assign_package" | "permanent_purge";
type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";
type OrganizationSubscriptionActionStatus = "active" | "trial" | "expired" | "suspended" | "cancelled";
type ApprovalRequestRow = {
  id: string;
  organization_id: string;
  action: ApprovalAction;
  status: ApprovalStatus;
  requested_by: string | null;
  reviewed_by: string | null;
  target_user_id: string | null;
  payload: Json;
  before_snapshot: Json;
  after_snapshot: Json;
  reason: string | null;
  review_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};
type ApprovalRequestInsert = Pick<
  ApprovalRequestRow,
  "organization_id" | "action" | "requested_by" | "target_user_id" | "payload" | "before_snapshot" | "after_snapshot" | "reason" | "expires_at"
>;
type ApprovalRequestUpdate = Partial<Pick<ApprovalRequestRow, "status" | "reviewed_by" | "review_note" | "reviewed_at">>;

type ApplyApprovalRpcClient = SupabaseClient<Database> & {
  rpc(
    functionName: "apply_organization_approval_request",
    args: {
      p_approval_id: string;
      p_reviewer_id: string;
      p_review_note: string | null;
    }
  ): Promise<{ data: Json | null; error: { message: string } | null }>;
};

type OrganizationActionSupplementClient = SupabaseClient<Database> & {
  from(table: "activity_events"): {
    insert(payload: {
      organization_id: string;
      actor_id: string | null;
      event_type: string;
      entity_type: "organization";
      entity_id: string;
      severity: "info" | "notice" | "warning" | "critical";
      metadata: Json;
    }): Promise<{ error: { message: string } | null }>;
  };
};

type ApprovalRequestQuery = {
  select(columns: string): ApprovalRequestFilterQuery;
  insert(payload: ApprovalRequestInsert): ApprovalRequestReturningQuery;
  update(payload: ApprovalRequestUpdate): ApprovalRequestUpdateQuery;
};

type ApprovalRequestFilterQuery = {
  eq(column: "id" | "organization_id" | "action" | "status", value: string): ApprovalRequestFilterQuery;
  maybeSingle(): Promise<{ data: ApprovalRequestRow | null; error: { code?: string; message: string } | null }>;
  limit(count: number): Promise<{ data: ApprovalRequestRow[] | null; error: { code?: string; message: string } | null }>;
};

type ApprovalRequestReturningQuery = {
  select(columns: string): {
    maybeSingle(): Promise<{ data: ApprovalRequestRow | null; error: { code?: string; message: string } | null }>;
  };
};

type ApprovalRequestUpdateQuery = {
  eq(column: "id", value: string): ApprovalRequestReturningQuery;
};

type ApprovalRequestClient = {
  from(table: "organization_approval_requests"): ApprovalRequestQuery;
};

type ApprovalCreateResult =
  | { status: "success"; message: string; approvalId: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

export async function saveSuperAdminOrganizationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/organizations");
  const parsed = saveSuperAdminOrganizationSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    organizationType: formData.get("organizationType") ?? "single_gym",
    status: formData.get("status") ?? "active",
    primaryDomain: formData.get("primaryDomain") ?? "",
    billingEmail: formData.get("billingEmail") ?? "",
    ownerUserId: formData.get("ownerUserId") ?? "",
    legalName: formData.get("legalName") ?? "",
    gstNumber: formData.get("gstNumber") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    supportNotes: formData.get("supportNotes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = parsed.data.organizationId || "";
  const slug = parsed.data.slug || slugifyEnterpriseName(parsed.data.name);
  const primaryDomain = parsed.data.primaryDomain ? normalizeDomain(parsed.data.primaryDomain) : null;

  if (!slug) {
    return fieldError("slug", "A valid slug is required.");
  }

  const existing = organizationId ? await getOrganization(supabase, organizationId) : null;
  const duplicateSlug = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .neq("id", organizationId || "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  if (duplicateSlug.error) {
    return { status: "error", message: duplicateSlug.error.message };
  }

  if (duplicateSlug.data) {
    return fieldError("slug", "This slug is already used by another organization.");
  }

  if (primaryDomain) {
    const duplicateDomain = await supabase
      .from("organizations")
      .select("id")
      .eq("primary_domain", primaryDomain)
      .neq("id", organizationId || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    if (duplicateDomain.error) {
      return { status: "error", message: duplicateDomain.error.message };
    }

    if (duplicateDomain.data) {
      return fieldError("primaryDomain", "This primary domain is already assigned to another organization.");
    }
  }

  const settings = mergeOrganizationSettings(existing?.settings, {
    legalName: parsed.data.legalName,
    gstNumber: parsed.data.gstNumber,
    phone: parsed.data.phone,
    address: parsed.data.address,
    supportNotes: parsed.data.supportNotes
  });
  const payload: Database["public"]["Tables"]["organizations"]["Update"] = {
    name: parsed.data.name,
    slug,
    organization_type: parsed.data.organizationType,
    status: parsed.data.status,
    primary_domain: primaryDomain,
    billing_email: parsed.data.billingEmail || null,
    owner_user_id: parsed.data.ownerUserId || null,
    settings,
    created_by: existing ? existing.owner_user_id ?? context.userId : context.userId
  };
  const result = organizationId
    ? await supabase.from("organizations").update(payload).eq("id", organizationId).select("*").maybeSingle()
    : await supabase.from("organizations").insert(payload as Database["public"]["Tables"]["organizations"]["Insert"]).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Organization save failed." };
  }

  // Auto-assign organization_owner role if an owner was set on a new org
  if (!organizationId && parsed.data.ownerUserId) {
    try {
      const { data: role } = await supabase.from("roles").select("id").eq("name", "organization_owner").maybeSingle();
      if (role) {
        await supabase.from("user_roles").upsert({
          user_id: parsed.data.ownerUserId,
          role_id: role.id,
          gym_id: null,
          assigned_by: context.userId
        }).then(() => {});
      }
    } catch {
      // Role assignment is best-effort - org creation already succeeded
    }
  }

  const beforeSnapshot = existing ? buildOrganizationSnapshot(existing) : null;
  const afterSnapshot = buildOrganizationSnapshot(result.data);
  await writeOrganizationAudit(context, result.data.id, organizationId ? "organization.updated" : "organization.created", organizationId ? "notice" : "info", {
    name: result.data.name,
    status: result.data.status,
    primaryDomain,
    before: beforeSnapshot,
    after: afterSnapshot,
    diff: beforeSnapshot ? buildOrganizationDiff(beforeSnapshot, afterSnapshot) : []
  });
  revalidateOrganizationPaths();
  return { status: "success", message: organizationId ? "Organization updated." : "Organization created." };
}

export async function transferOrganizationOwnerAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/organizations");
  const parsed = transferOrganizationOwnerSchema.safeParse({
    organizationId: formData.get("organizationId"),
    newOwnerUserId: formData.get("newOwnerUserId"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "TRANSFER") {
    return fieldError("confirmation", "Type TRANSFER to confirm ownership transfer.");
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const organization = await getOrganization(supabase, parsed.data.organizationId);
  if (!organization) {
    return { status: "error", message: "Organization was not found." };
  }

  if (organization.owner_user_id === parsed.data.newOwnerUserId) {
    return { status: "success", message: "Selected user already owns this organization." };
  }

  const { data: newOwner, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, status")
    .eq("id", parsed.data.newOwnerUserId)
    .maybeSingle();

  if (profileError) {
    return { status: "error", message: profileError.message };
  }

  if (!newOwner || newOwner.status === "archived" || newOwner.status === "suspended") {
    return fieldError("newOwnerUserId", "Select an active or invited profile as the new owner.");
  }

  const mfa = criticalAccess.mfa;
  const beforeSnapshot = buildOrganizationSnapshot(organization);
  const afterSnapshot: OrganizationGovernanceSnapshot = {
    ...beforeSnapshot,
    ownerUserId: parsed.data.newOwnerUserId
  };
  const approvalResult = await createOrganizationApprovalRequest(supabase, context, {
    organization,
    action: "transfer_owner",
    targetUserId: parsed.data.newOwnerUserId,
    payload: {
      newOwnerUserId: parsed.data.newOwnerUserId,
      newOwnerEmail: newOwner.email,
      newOwnerName: newOwner.full_name
    },
    beforeSnapshot,
    afterSnapshot,
    reason: parsed.data.reason || null
  });

  if (approvalResult.status === "error") {
    return approvalResult;
  }

  await writeOrganizationAudit(context, organization.id, "organization.owner_transfer_requested", "critical", {
    previousOwnerUserId: organization.owner_user_id,
    newOwnerUserId: parsed.data.newOwnerUserId,
    newOwnerEmail: newOwner.email,
    reason: parsed.data.reason || null,
    approvalId: approvalResult.approvalId,
    before: beforeSnapshot,
    after: afterSnapshot,
    diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
    stepUp: {
      method: "super_admin_email_confirmation",
      email: context.email,
      mfaCurrentLevel: mfa.currentLevel,
      mfaNextLevel: mfa.nextLevel
    }
  });
  revalidateOrganizationPaths();
  return { status: "success", message: "Ownership transfer approval requested. Review it from the approvals inbox after fresh MFA verification." };
}

export async function organizationLifecycleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/organizations");
  const parsed = organizationLifecycleActionSchema.safeParse({
    organizationId: formData.get("organizationId"),
    action: formData.get("action"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const organization = await getOrganization(supabase, parsed.data.organizationId);
  if (!organization) {
    return { status: "error", message: "Organization was not found." };
  }

  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const mfa = criticalAccess.mfa;

  if (parsed.data.action === "suspend") {
    if (parsed.data.confirmation !== "SUSPEND") {
      return fieldError("confirmation", "Type SUSPEND to confirm suspension.");
    }

    const beforeSnapshot = buildOrganizationSnapshot(organization);
    const afterSnapshot: OrganizationGovernanceSnapshot = {
      ...beforeSnapshot,
      status: "suspended"
    };
    const approvalResult = await createOrganizationApprovalRequest(supabase, context, {
      organization,
      action: "suspend",
      targetUserId: null,
      payload: { nextStatus: "suspended" },
      beforeSnapshot,
      afterSnapshot,
      reason: parsed.data.reason || null
    });

    if (approvalResult.status === "error") {
      return approvalResult;
    }

    await writeOrganizationAudit(context, organization.id, "organization.suspension_requested", "critical", {
      reason: parsed.data.reason || null,
      approvalId: approvalResult.approvalId,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    revalidateOrganizationPaths();
    return { status: "success", message: "Suspension approval requested. Review it from the approvals inbox after fresh MFA verification." };
  }

  if (parsed.data.action === "activate") {
    if (parsed.data.confirmation !== "ACTIVATE") {
      return fieldError("confirmation", "Type ACTIVATE to confirm activation.");
    }

    if (organization.status === "archived") {
      return { status: "error", message: "Archived organizations must be restored through the restore workflow." };
    }

    const beforeSnapshot = buildOrganizationSnapshot(organization);
    const result = await supabase.from("organizations").update({ status: "active" }).eq("id", organization.id).select("*").maybeSingle();
    if (result.error || !result.data) {
      return { status: "error", message: result.error?.message ?? "Organization activation failed." };
    }
    const afterSnapshot = buildOrganizationSnapshot(result.data);
    const notificationResult = await sendOrganizationLifecycleNotification(supabase, {
      organization: result.data,
      action: "activated",
      actorEmail: context.email,
      reason: parsed.data.reason || null
    });
    await writeOrganizationAudit(context, organization.id, "organization.activated", "notice", {
      reason: parsed.data.reason || null,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      notifications: notificationResult,
      stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    revalidateOrganizationPaths();
    return { status: "success", message: "Organization activated." };
  }

  if (parsed.data.action === "restore") {
    if (parsed.data.confirmation !== "RESTORE") {
      return fieldError("confirmation", "Type RESTORE to confirm tenant restoration.");
    }

    const softDelete = getOrganizationSoftDeleteState(organization.settings);
    if (organization.status !== "archived" || !isRestoreWindowOpen(softDelete.restoreUntil)) {
      return { status: "error", message: "This organization is not inside an active restore window." };
    }

    const beforeSnapshot = buildOrganizationSnapshot(organization);
    const restoredSettings = mergeRestoredOrganizationSettings(organization.settings, {
      restoredAt: new Date().toISOString(),
      restoredBy: context.userId
    });
    const result = await supabase
      .from("organizations")
      .update({ status: "active", settings: restoredSettings })
      .eq("id", organization.id)
      .select("*")
      .maybeSingle();

    if (result.error || !result.data) {
      return { status: "error", message: result.error?.message ?? "Organization restore failed." };
    }

    const afterSnapshot = buildOrganizationSnapshot(result.data);
    const notificationResult = await sendOrganizationLifecycleNotification(supabase, {
      organization: result.data,
      action: "restored",
      actorEmail: context.email,
      reason: parsed.data.reason || null
    });
    await writeOrganizationAudit(context, organization.id, "organization.restored", "critical", {
      reason: parsed.data.reason || null,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      notifications: notificationResult,
      stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    revalidateOrganizationPaths();
    return { status: "success", message: "Organization restored." };
  }

  if (parsed.data.action === "purge") {
    const expectedConfirmation = `PURGE:${organization.slug}`;
    if (parsed.data.confirmation !== expectedConfirmation) {
      return fieldError("confirmation", `Type ${expectedConfirmation} to request permanent purge.`);
    }

    const softDelete = getOrganizationSoftDeleteState(organization.settings);
    const legalHold = getOrganizationLegalHoldState(organization.settings);
    const deletionProtection = await getOperationalPurgeProtection(supabase, organization.id);
    const purgeEligibility = getOrganizationPurgeEligibility({
      status: organization.status,
      softDelete,
      legalHold,
      operationalBlockers: deletionProtection.reasons
    });

    if (!purgeEligibility.eligible) {
      return {
        status: "error",
        message: `Permanent purge is blocked: ${purgeEligibility.reasons.join(" ")}`
      };
    }

    const beforeSnapshot = buildOrganizationSnapshot(organization);
    const purgeRequestedAt = new Date().toISOString();
    const purgeRequestedSettings = mergePermanentPurgeRequestedSettings(organization.settings, {
      requestedAt: purgeRequestedAt,
      requestedBy: context.userId,
      reason: parsed.data.reason || null,
      approvalId: null
    });
    const afterSnapshot = buildOrganizationSnapshot({
      ...organization,
      settings: purgeRequestedSettings
    });
    const approvalResult = await createOrganizationApprovalRequest(supabase, context, {
      organization,
      action: "permanent_purge",
      targetUserId: null,
      payload: {
        requestedAt: purgeRequestedAt,
        retentionMode: "retained_governance_tombstone"
      },
      beforeSnapshot,
      afterSnapshot,
      reason: parsed.data.reason || null
    });

    if (approvalResult.status === "error") {
      return approvalResult;
    }

    await writeOrganizationAudit(context, organization.id, "organization.permanent_purge_requested", "critical", {
      reason: parsed.data.reason || null,
      slug: organization.slug,
      approvalId: approvalResult.approvalId,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    revalidateOrganizationPaths();
    return { status: "success", message: "Permanent purge approval requested. Review it from the approvals inbox after fresh MFA verification before tenant data is purged to a retained governance tombstone." };
  }

  if (parsed.data.confirmation !== organization.slug) {
    return fieldError("confirmation", `Type ${organization.slug} to confirm soft deletion.`);
  }

  const requestedAt = new Date();
  const restoreUntil = new Date(requestedAt.getTime() + restoreWindowDays * 24 * 60 * 60 * 1000).toISOString();
  const beforeSnapshot = buildOrganizationSnapshot(organization);
  const softDeletedSettings = mergeSoftDeleteSettings(organization.settings, {
    deletedAt: requestedAt.toISOString(),
    restoreUntil,
    deletedBy: context.userId,
    reason: parsed.data.reason || null,
    approvalId: null
  });
  const afterSnapshot = buildOrganizationSnapshot({
    ...organization,
    status: "archived",
    settings: softDeletedSettings
  });
  const approvalResult = await createOrganizationApprovalRequest(supabase, context, {
    organization,
    action: "delete",
    targetUserId: null,
    payload: {
      nextStatus: "archived",
      restoreWindowDays,
      restoreUntil
    },
    beforeSnapshot,
    afterSnapshot,
    reason: parsed.data.reason || null,
  });

  if (approvalResult.status === "error") {
    return approvalResult;
  }

  await writeOrganizationAudit(context, organization.id, "organization.delete_requested", "critical", {
    reason: parsed.data.reason || null,
    slug: organization.slug,
    approvalId: approvalResult.approvalId,
    restoreUntil,
    before: beforeSnapshot,
    after: afterSnapshot,
    diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
    stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
  });
  revalidateOrganizationPaths();
  return { status: "success", message: `Soft-delete approval requested. If approved, this tenant can be restored for ${restoreWindowDays} days.` };
}

export async function organizationLegalHoldAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/organizations");
  const parsed = organizationLegalHoldActionSchema.safeParse({
    organizationId: formData.get("organizationId"),
    action: formData.get("action"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const expectedConfirmation = parsed.data.action === "hold" ? "HOLD" : "RELEASE";
  if (parsed.data.confirmation !== expectedConfirmation) {
    return fieldError("confirmation", `Type ${expectedConfirmation} to continue.`);
  }

  if (parsed.data.action === "hold" && !parsed.data.reason?.trim()) {
    return fieldError("reason", "Legal hold reason is required.");
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const organization = await getOrganization(supabase, parsed.data.organizationId);
  if (!organization) {
    return { status: "error", message: "Organization was not found." };
  }

  const beforeSnapshot = buildOrganizationSnapshot(organization);
  const nextSettings = mergeLegalHoldSettings(organization.settings, {
    active: parsed.data.action === "hold",
    reason: parsed.data.action === "hold" ? parsed.data.reason?.trim() ?? null : parsed.data.reason?.trim() || "Legal hold released.",
    updatedAt: new Date().toISOString(),
    updatedBy: context.userId
  });
  const result = await supabase
    .from("organizations")
    .update({ settings: nextSettings })
    .eq("id", organization.id)
    .select("*")
    .maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Legal hold update failed." };
  }

  const afterSnapshot = buildOrganizationSnapshot(result.data);
  await writeOrganizationAudit(context, organization.id, parsed.data.action === "hold" ? "organization.legal_hold_applied" : "organization.legal_hold_released", "critical", {
    reason: parsed.data.reason || null,
    before: beforeSnapshot,
    after: afterSnapshot,
    diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
    stepUp: {
      method: "super_admin_email_confirmation",
      email: context.email,
      mfaCurrentLevel: criticalAccess.mfa.currentLevel,
      mfaNextLevel: criticalAccess.mfa.nextLevel
    }
  });
  revalidateOrganizationPaths();
  return {
    status: "success",
    message: parsed.data.action === "hold" ? "Legal hold applied. Permanent purge is blocked until the hold is released." : "Legal hold released."
  };
}

export async function bulkOrganizationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/organizations");
  const parsed = bulkOrganizationActionSchema.safeParse({
    organizationIds: formData.getAll("organizationIds"),
    action: formData.get("action"),
    packageId: formData.get("packageId") ?? "",
    status: formData.get("status") ?? "active",
    tags: formData.get("tags") ?? "",
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.confirmation !== "BULK") {
    return fieldError("confirmation", "Type BULK to confirm this bulk operation.");
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) {
    return criticalAccess.state;
  }

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status, settings, owner_user_id, organization_type, primary_domain, billing_email")
    .in("id", parsed.data.organizationIds);

  if (error) {
    return { status: "error", message: error.message };
  }

  if (!organizations || organizations.length === 0) {
    return { status: "error", message: "No matching organizations were found." };
  }

  const mfa = criticalAccess.mfa;

  if (parsed.data.action === "suspend") {
    let requested = 0;
    for (const organization of organizations) {
      const beforeSnapshot = buildOrganizationSnapshot(organization);
      const afterSnapshot: OrganizationGovernanceSnapshot = {
        ...beforeSnapshot,
        status: "suspended"
      };
      const approvalResult = await createOrganizationApprovalRequest(supabase, context, {
        organization,
        action: "bulk_suspend",
        targetUserId: null,
        payload: {
          nextStatus: "suspended",
          bulkSize: organizations.length
        },
        beforeSnapshot,
        afterSnapshot,
        reason: parsed.data.reason || null
      });

      if (approvalResult.status === "error") {
        return approvalResult;
      }

      requested += 1;
      await writeOrganizationAudit(context, organization.id, "organization.bulk_suspend_requested", "critical", {
        action: parsed.data.action,
        reason: parsed.data.reason || null,
        affectedOrganizations: organizations.length,
        approvalId: approvalResult.approvalId,
        before: beforeSnapshot,
        after: afterSnapshot,
        diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
        stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
      });
    }

    revalidateOrganizationPaths();
    return { status: "success", message: `Bulk suspension approvals requested for ${requested} organization(s).` };
  }

  if (parsed.data.action === "activate") {
    const result = await supabase
      .from("organizations")
      .update({ status: "active" })
      .in("id", organizations.map((organization) => organization.id));

    if (result.error) {
      return { status: "error", message: result.error.message };
    }
  }

  if (parsed.data.action === "assign_package" && parsed.data.packageId) {
    let requested = 0;
    for (const organization of organizations) {
      const beforeSnapshot = buildOrganizationSnapshot(organization);
      const approvalResult = await createOrganizationApprovalRequest(supabase, context, {
        organization,
        action: "bulk_assign_package",
        targetUserId: null,
        payload: {
          packageId: parsed.data.packageId,
          status: parsed.data.status ?? "active"
        },
        beforeSnapshot,
        afterSnapshot: beforeSnapshot,
        reason: parsed.data.reason || null
      });

      if (approvalResult.status === "error") {
        return approvalResult;
      }

      requested += 1;
      await writeOrganizationAudit(context, organization.id, "organization.bulk_package_assignment_requested", "notice", {
        action: parsed.data.action,
        reason: parsed.data.reason || null,
        packageId: parsed.data.packageId || null,
        subscriptionStatus: parsed.data.status ?? "active",
        affectedOrganizations: organizations.length,
        approvalId: approvalResult.approvalId,
        stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
      });
    }

    revalidateOrganizationPaths();
    return { status: "success", message: `Bulk package assignment approvals requested for ${requested} organization(s).` };
  }

  if (parsed.data.action === "tag") {
    const tags = parseCsvList(parsed.data.tags ?? "").map((tag) => tag.slice(0, 32)).slice(0, 12);
    for (const organization of organizations) {
      const nextSettings = mergeOrganizationSettingsWithTags(organization.settings, tags);
      const result = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organization.id);
      if (result.error) {
        return { status: "error", message: result.error.message };
      }
    }
  }

  for (const organization of organizations) {
    await writeOrganizationAudit(context, organization.id, `organization.bulk_${parsed.data.action}`, "notice", {
      action: parsed.data.action,
      reason: parsed.data.reason || null,
      packageId: parsed.data.packageId || null,
      tags: parsed.data.tags || null,
      affectedOrganizations: organizations.length,
      stepUp: { method: "super_admin_email_confirmation", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
  }

  revalidateOrganizationPaths();
  return { status: "success", message: `Bulk ${parsed.data.action.replaceAll("_", " ")} completed for ${organizations.length} organization(s).` };
}

export async function reviewOrganizationApprovalAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/organizations");
  const parsed = reviewOrganizationApprovalSchema.safeParse({
    approvalId: formData.get("approvalId"),
    decision: formData.get("decision"),
    confirmation: formData.get("confirmation") ?? "",
    reviewNote: formData.get("reviewNote") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const expectedConfirmation = parsed.data.decision === "approve" ? "APPROVE" : parsed.data.decision === "reject" ? "REJECT" : "CANCEL";
  if (parsed.data.confirmation !== expectedConfirmation) {
    return fieldError("confirmation", `Type ${expectedConfirmation} to continue.`);
  }

  const supabase = await createSupabaseServerClient();
  const mfaAccess = await verifyCurrentSuperAdminMfaAccess(supabase);
  if (!mfaAccess.ok) {
    return mfaAccess.state;
  }

  const approval = await getApprovalRequest(supabase, parsed.data.approvalId);
  if (!approval) {
    return { status: "error", message: "Approval request was not found." };
  }

  if (approval.status !== "pending") {
    return { status: "error", message: `This approval request is already ${approval.status}.` };
  }

  if (new Date(approval.expires_at).getTime() <= Date.now()) {
    await updateApprovalRequest(supabase, approval.id, {
      status: "expired",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_note: "Expired before review."
    });
    revalidateOrganizationPaths();
    return { status: "error", message: "This approval request has expired. Create a fresh request." };
  }

  const organization = await getOrganization(supabase, approval.organization_id);
  if (!organization) {
    return { status: "error", message: "Organization was not found." };
  }

  if (parsed.data.decision !== "approve") {
    const nextStatus = parsed.data.decision === "reject" ? "rejected" : "cancelled";
    const updateResult = await updateApprovalRequest(supabase, approval.id, {
      status: nextStatus,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_note: parsed.data.reviewNote || null
    });

    if (updateResult.status === "error") {
      return updateResult;
    }

    await writeOrganizationAudit(context, organization.id, `organization.approval_${nextStatus}`, "notice", {
      approvalId: approval.id,
      approvalAction: approval.action,
      reviewNote: parsed.data.reviewNote || null,
      requestedBy: approval.requested_by
    });
    revalidateOrganizationPaths();
    return { status: "success", message: `Approval request ${nextStatus}.` };
  }

  const applyResult = await applyApprovedOrganizationAction(supabase, context, organization, approval, mfaAccess.mfa, parsed.data.reviewNote || null);
  if (applyResult.status === "error") {
    return applyResult;
  }

  revalidateOrganizationPaths();
  return { status: "success", message: "Approval applied successfully." };
}

async function createOrganizationApprovalRequest(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  input: {
    organization: OrganizationMinimalRow;
    action: ApprovalAction;
    targetUserId: string | null;
    payload: Record<string, Json | undefined>;
    beforeSnapshot: OrganizationGovernanceSnapshot;
    afterSnapshot: OrganizationGovernanceSnapshot;
    reason: string | null;
  }
): Promise<ApprovalCreateResult> {
  const client = supabase as unknown as ApprovalRequestClient;
  const existing = await client
    .from("organization_approval_requests")
    .select("id, status")
    .eq("organization_id", input.organization.id)
    .eq("action", input.action)
    .eq("status", "pending")
    .maybeSingle();

  if (existing.error && existing.error.code !== "PGRST116") {
    return { status: "error", message: existing.error.message };
  }

  if (existing.data) {
    return { status: "error", message: "A pending approval already exists for this organization action." };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await client
    .from("organization_approval_requests")
    .insert({
      organization_id: input.organization.id,
      action: input.action,
      requested_by: context.userId,
      target_user_id: input.targetUserId,
      payload: input.payload as Json,
      before_snapshot: input.beforeSnapshot as unknown as Json,
      after_snapshot: input.afterSnapshot as unknown as Json,
      reason: input.reason,
      expires_at: expiresAt
    })
    .select("id")
    .maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Approval request could not be created." };
  }

  return { status: "success", message: "Approval request created.", approvalId: result.data.id };
}

async function getApprovalRequest(supabase: SupabaseClient<Database>, approvalId: string) {
  const client = supabase as unknown as ApprovalRequestClient;
  const { data, error } = await client
    .from("organization_approval_requests")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function updateApprovalRequest(
  supabase: SupabaseClient<Database>,
  approvalId: string,
  payload: ApprovalRequestUpdate
): Promise<AuthActionState> {
  const client = supabase as unknown as ApprovalRequestClient;
  const result = await client
    .from("organization_approval_requests")
    .update(payload)
    .eq("id", approvalId)
    .select("id")
    .maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Approval request update failed." };
  }

  return { status: "success", message: "Approval request updated." };
}

async function applyApprovedOrganizationAction(
  supabase: SupabaseClient<Database>,
  context: AuthContext,
  organization: OrganizationMinimalRow,
  approval: ApprovalRequestRow,
  mfa: { currentLevel: string | null; nextLevel: string | null },
  reviewNote: string | null
): Promise<AuthActionState> {
  const rpcClient = supabase as ApplyApprovalRpcClient;
  const payload = jsonObject(approval.payload);
  const beforeSnapshot = snapshotFromJson(approval.before_snapshot) ?? buildOrganizationSnapshot(organization);
  const reviewerId = context.userId;

  if (!reviewerId) {
    return { status: "error", message: "Authenticated reviewer context is required." };
  }

  const rpcResult = await rpcClient.rpc("apply_organization_approval_request", {
    p_approval_id: approval.id,
    p_reviewer_id: reviewerId,
    p_review_note: reviewNote
  });

  if (rpcResult.error) {
    return { status: "error", message: rpcResult.error.message };
  }

  if (approval.action === "transfer_owner") {
    const newOwnerUserId = stringFromJson(payload.newOwnerUserId);
    if (!newOwnerUserId) {
      return { status: "error", message: "Approval payload is missing the new owner." };
    }

    const { data: newOwner, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("id", newOwnerUserId)
      .maybeSingle();

    if (profileError) {
      return { status: "error", message: profileError.message };
    }

    if (!newOwner || newOwner.status === "archived" || newOwner.status === "suspended") {
      return { status: "error", message: "The requested new owner is no longer active." };
    }

    const previousOwner = organization.owner_user_id ? await getProfileForNotification(supabase, organization.owner_user_id) : null;
    const updatedOrganization = await getOrganization(supabase, organization.id);
    const afterSnapshot = updatedOrganization ? buildOrganizationSnapshot(updatedOrganization) : snapshotFromJson(approval.after_snapshot) ?? beforeSnapshot;

    const notificationResult = await sendOwnershipTransferNotifications({
      organizationName: organization.name,
      previousOwner,
      newOwner: {
        full_name: newOwner.full_name,
        email: newOwner.email
      },
      actorEmail: context.email,
      reason: approval.reason
    });

    await writeOrganizationAudit(context, organization.id, "organization.owner_transferred", "critical", {
      approvalId: approval.id,
      requestedBy: approval.requested_by,
      previousOwnerUserId: organization.owner_user_id,
      newOwnerUserId,
      newOwnerEmail: newOwner.email,
      reason: approval.reason,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      notifications: notificationResult,
      stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    return { status: "success", message: "Ownership transfer applied." };
  }

  if (approval.action === "suspend" || approval.action === "bulk_suspend") {
    const updatedOrganization = await getOrganization(supabase, organization.id);
    const afterSnapshot = updatedOrganization ? buildOrganizationSnapshot(updatedOrganization) : snapshotFromJson(approval.after_snapshot) ?? beforeSnapshot;
    const notificationResult = await sendOrganizationLifecycleNotification(supabase, {
      organization: updatedOrganization ?? organization,
      action: "suspended",
      actorEmail: context.email,
      reason: approval.reason
    });
    await writeOrganizationAudit(context, organization.id, "organization.suspended", "critical", {
      approvalId: approval.id,
      requestedBy: approval.requested_by,
      reason: approval.reason,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      notifications: notificationResult,
      stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    return { status: "success", message: "Organization suspended." };
  }

  if (approval.action === "delete") {
    const updatedOrganization = await getOrganization(supabase, organization.id);
    const afterSnapshot = updatedOrganization ? buildOrganizationSnapshot(updatedOrganization) : snapshotFromJson(approval.after_snapshot) ?? beforeSnapshot;
    const softDelete = updatedOrganization ? getOrganizationSoftDeleteState(updatedOrganization.settings) : null;
    const notificationResult = await sendOrganizationLifecycleNotification(supabase, {
      organization: updatedOrganization ?? organization,
      action: "soft-deleted",
      actorEmail: context.email,
      reason: approval.reason
    });
    await writeOrganizationAudit(context, organization.id, "organization.soft_deleted", "critical", {
      approvalId: approval.id,
      requestedBy: approval.requested_by,
      reason: approval.reason,
      restoreUntil: softDelete?.restoreUntil ?? null,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      notifications: notificationResult,
      stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    return { status: "success", message: "Organization soft-deleted." };
  }

  if (approval.action === "bulk_assign_package") {
    const packageId = stringFromJson(payload.packageId);
    const status = subscriptionStatusFromJson(payload.status);
    if (!packageId) {
      return { status: "error", message: "Approval payload is missing the package." };
    }

    await writeOrganizationAudit(context, organization.id, "organization.package_assigned", "notice", {
      approvalId: approval.id,
      requestedBy: approval.requested_by,
      packageId,
      subscriptionStatus: status,
      reason: approval.reason,
      stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    return { status: "success", message: "Package assignment applied." };
  }

  if (approval.action === "permanent_purge") {
    const updatedOrganization = await getOrganization(supabase, organization.id);
    const afterSnapshot = updatedOrganization ? buildOrganizationSnapshot(updatedOrganization) : snapshotFromJson(approval.after_snapshot) ?? beforeSnapshot;
    const notificationResult = await sendOrganizationLifecycleNotification(supabase, {
      organization,
      action: "permanently purged",
      actorEmail: context.email,
      reason: approval.reason
    });
    await writeOrganizationAudit(context, organization.id, "organization.permanently_purged", "critical", {
      approvalId: approval.id,
      requestedBy: approval.requested_by,
      reason: approval.reason,
      before: beforeSnapshot,
      after: afterSnapshot,
      diff: buildOrganizationDiff(beforeSnapshot, afterSnapshot),
      notifications: notificationResult,
      retentionMode: "retained_governance_tombstone",
      stepUp: { method: "maker_checker_mfa", email: context.email, mfaCurrentLevel: mfa.currentLevel, mfaNextLevel: mfa.nextLevel }
    });
    return { status: "success", message: "Organization purged to retained governance tombstone." };
  }

  return { status: "error", message: "Unsupported approval action." };
}

async function verifyCriticalSuperAdminAccess(
  context: AuthContext,
  supabase: SupabaseClient<Database>,
  value: string
): Promise<
  | { ok: true; mfa: { currentLevel: string | null; nextLevel: string | null } }
  | { ok: false; state: AuthActionState }
> {
  const email = context.email?.trim().toLowerCase() ?? null;
  const requiredEmail = getCriticalSuperAdminEmail();

  if (email !== requiredEmail) {
    return {
      ok: false,
      state: {
        status: "error",
        message: `Critical Super Admin actions must be performed from ${requiredEmail}. Sign in with that account and verify MFA before retrying.`
      }
    };
  }

  if (value.trim().toLowerCase() !== requiredEmail) {
    return {
      ok: false,
      state: fieldError("stepUpEmail", `Type ${requiredEmail} to pass the step-up identity check.`)
    };
  }

  const mfa = await getMfaAssuranceLevel(supabase);
  if (mfa.currentLevel !== "aal2") {
    return {
      ok: false,
      state: {
        status: "error",
        message: "MFA verification is required before running this critical Super Admin action. Open Super Admin MFA, verify a current authenticator code, then retry.",
        fieldErrors: {
          stepUpEmail: ["Verify MFA at /super-admin/security/mfa before submitting this action."]
        }
      }
    };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaFreshnessCookieName)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "MFA verification is stale. Open Super Admin MFA, verify a fresh authenticator code, then retry this critical action.",
        fieldErrors: {
          stepUpEmail: ["Verify a fresh MFA challenge within the last 10 minutes."]
        }
      }
    };
  }

  return { ok: true, mfa };
}

async function verifyCurrentSuperAdminMfaAccess(
  supabase: SupabaseClient<Database>
): Promise<
  | { ok: true; mfa: { currentLevel: string | null; nextLevel: string | null } }
  | { ok: false; state: AuthActionState }
> {
  const mfa = await getMfaAssuranceLevel(supabase);
  if (mfa.currentLevel !== "aal2") {
    return {
      ok: false,
      state: {
        status: "error",
        message: "MFA verification is required before reviewing this approval. Enter your authenticator code on this page, verify the session, then submit again.",
        fieldErrors: {
          confirmation: ["Verify MFA on this page before submitting the review."]
        }
      }
    };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaFreshnessCookieName)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "MFA verification is stale. Enter a fresh authenticator code on this page, verify the session, then submit again.",
        fieldErrors: {
          confirmation: ["Verify a fresh MFA challenge within the last 10 minutes."]
        }
      }
    };
  }

  return { ok: true, mfa };
}

async function getMfaAssuranceLevel(supabase: SupabaseClient<Database>) {
  try {
    const result = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return {
      currentLevel: result.data?.currentLevel ?? null,
      nextLevel: result.data?.nextLevel ?? null
    };
  } catch {
    return {
      currentLevel: null,
      nextLevel: null
    };
  }
}

async function getProfileForNotification(supabase: SupabaseClient<Database>, userId: string): Promise<NotificationProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  return data ?? null;
}

async function sendOwnershipTransferNotifications(input: {
  organizationName: string;
  previousOwner: NotificationProfile | null;
  newOwner: NotificationProfile;
  actorEmail: string | null;
  reason: string | null;
}) {
  const recipients = [
    input.newOwner.email ? { type: "new_owner", profile: input.newOwner } : null,
    input.previousOwner?.email ? { type: "previous_owner", profile: input.previousOwner } : null
  ].filter((recipient): recipient is { type: "new_owner" | "previous_owner"; profile: NotificationProfile } => Boolean(recipient));
  const results: Array<{ recipient: string; type: "new_owner" | "previous_owner"; sent: boolean; reason: string | null }> = [];

  for (const recipient of recipients) {
    const message = await sendEmail({
      to: recipient.profile.email as string,
      subject: `Organization ownership updated: ${input.organizationName}`,
      html: renderBrandedEmail({
        title: recipient.type === "new_owner" ? "You are now the organization owner" : "Organization ownership was transferred",
        preview: `Ownership changed for ${input.organizationName}.`,
        body: [
          `<p>Hi ${escapeEmailHtml(recipient.profile.full_name || "there")},</p>`,
          `<p>The organization owner for <strong>${escapeEmailHtml(input.organizationName)}</strong> was updated by ${escapeEmailHtml(input.actorEmail ?? "a Super Admin")}.</p>`,
          input.reason ? `<p><strong>Reason:</strong> ${escapeEmailHtml(input.reason)}</p>` : "",
          "<p>If this was unexpected, contact platform support immediately.</p>"
        ].join("")
      })
    });

    results.push({
      recipient: recipient.profile.email as string,
      type: recipient.type,
      sent: message.sent,
      reason: message.reason
    });
  }

  return results;
}

async function sendOrganizationLifecycleNotification(
  supabase: SupabaseClient<Database>,
  input: {
    organization: OrganizationMinimalRow;
    action: "activated" | "suspended" | "soft-deleted" | "restored" | "permanently purged";
    actorEmail: string | null;
    reason: string | null;
  }
) {
  const owner = input.organization.owner_user_id ? await getProfileForNotification(supabase, input.organization.owner_user_id) : null;
  const recipients = new Map<string, { type: "owner" | "billing"; name: string }>();

  if (owner?.email) {
    recipients.set(owner.email, { type: "owner", name: owner.full_name || "there" });
  }

  if (input.organization.billing_email && !recipients.has(input.organization.billing_email)) {
    recipients.set(input.organization.billing_email, { type: "billing", name: "billing team" });
  }

  const results: Array<{ recipient: string; type: "owner" | "billing"; sent: boolean; reason: string | null }> = [];
  for (const [email, recipient] of recipients.entries()) {
    const message = await sendEmail({
      to: email,
      subject: `Organization ${input.action}: ${input.organization.name}`,
      html: renderBrandedEmail({
        title: `Organization ${input.action}`,
        preview: `${input.organization.name} was ${input.action}.`,
        body: [
          `<p>Hi ${escapeEmailHtml(recipient.name)},</p>`,
          `<p><strong>${escapeEmailHtml(input.organization.name)}</strong> was ${escapeEmailHtml(input.action)} by ${escapeEmailHtml(input.actorEmail ?? "a Super Admin")}.</p>`,
          input.reason ? `<p><strong>Reason:</strong> ${escapeEmailHtml(input.reason)}</p>` : "",
          "<p>If this was unexpected, contact platform support immediately.</p>"
        ].join("")
      })
    });

    results.push({
      recipient: email,
      type: recipient.type,
      sent: message.sent,
      reason: message.reason
    });
  }

  return results;
}

async function getOrganization(supabase: SupabaseClient<Database>, organizationId: string): Promise<OrganizationMinimalRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status, settings, owner_user_id, organization_type, primary_domain, billing_email")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getOperationalPurgeProtection(supabase: SupabaseClient<Database>, organizationId: string) {
  const { data: gyms, error: gymError } = await supabase.from("gyms").select("id").eq("organization_id", organizationId).limit(1000);
  if (gymError) {
    throw new Error(gymError.message);
  }
  const gymIds = gyms?.map((gym) => gym.id) ?? [];
  const [
    branchCount,
    branchUserCount,
    domainCount,
    memberCount,
    paymentCount
  ] = await Promise.all([
    countRows(supabase, "branches", "organization_id", organizationId),
    countRows(supabase, "branch_users", "organization_id", organizationId),
    countRows(supabase, "tenant_domains", "organization_id", organizationId),
    countRowsByGym(supabase, "members", gymIds),
    countRowsByGym(supabase, "payments", gymIds)
  ]);
  const reasons = [
    (gyms?.length ?? 0) > 0 ? `${gyms?.length ?? 0} gym records remain` : null,
    branchCount > 0 ? `${branchCount} branch records remain` : null,
    branchUserCount > 0 ? `${branchUserCount} user assignments remain` : null,
    domainCount > 0 ? `${domainCount} domain records remain` : null,
    memberCount > 0 ? `${memberCount} member records remain` : null,
    paymentCount > 0 ? `${paymentCount} payment records remain` : null
  ].filter((reason): reason is string => Boolean(reason));

  return {
    canDelete: reasons.length === 0,
    reasons
  };
}

async function countRows(supabase: SupabaseClient<Database>, table: "branches" | "branch_users" | "tenant_domains", column: "organization_id", value: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function countRowsByGym(supabase: SupabaseClient<Database>, table: "members" | "payments", gymIds: string[]) {
  if (gymIds.length === 0) {
    return 0;
  }
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).in("gym_id", gymIds);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function writeOrganizationAudit(
  context: AuthContext,
  organizationId: string,
  action: string,
  severity: "info" | "notice" | "warning" | "critical",
  metadata: Json
) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action,
    entityType: "organization",
    entityId: organizationId,
    metadata
  });

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }
  const activityClient = admin as unknown as OrganizationActionSupplementClient;
  await activityClient.from("activity_events").insert({
    organization_id: organizationId,
    actor_id: context.userId,
    event_type: action,
    entity_type: "organization",
    entity_id: organizationId,
    severity,
    metadata
  });
}

function mergeOrganizationSettings(existing: Json | undefined, updates: Record<string, string | undefined>): Json {
  const base = existing && typeof existing === "object" && !Array.isArray(existing)
    ? existing as Record<string, Json>
    : {};
  const businessProfile = base.businessProfile && typeof base.businessProfile === "object" && !Array.isArray(base.businessProfile)
    ? base.businessProfile as Record<string, Json>
    : {};

  return {
    ...base,
    businessProfile: {
      ...businessProfile,
      legalName: updates.legalName || null,
      gstNumber: updates.gstNumber || null,
      phone: updates.phone || null,
      address: updates.address || null,
      supportNotes: updates.supportNotes || null
    }
  };
}

function mergeOrganizationSettingsWithTags(existing: Json | undefined, tags: string[]): Json {
  const base = existing && typeof existing === "object" && !Array.isArray(existing)
    ? existing as Record<string, Json>
    : {};
  const existingTags = Array.isArray(base.enterpriseTags)
    ? base.enterpriseTags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const nextTags = Array.from(new Set([...existingTags, ...tags].map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);

  return {
    ...base,
    enterpriseTags: nextTags
  };
}

function jsonObject(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Json | undefined>;
}

function snapshotFromJson(value: Json): OrganizationGovernanceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const snapshot = value as Record<string, Json | undefined>;
  if (
    typeof snapshot.id !== "string" ||
    typeof snapshot.name !== "string" ||
    typeof snapshot.slug !== "string" ||
    typeof snapshot.status !== "string" ||
    typeof snapshot.organizationType !== "string"
  ) {
    return null;
  }

  return {
    id: snapshot.id,
    name: snapshot.name,
    slug: snapshot.slug,
    status: snapshot.status,
    organizationType: snapshot.organizationType,
    primaryDomain: typeof snapshot.primaryDomain === "string" ? snapshot.primaryDomain : null,
    billingEmail: typeof snapshot.billingEmail === "string" ? snapshot.billingEmail : null,
    ownerUserId: typeof snapshot.ownerUserId === "string" ? snapshot.ownerUserId : null,
    governance: snapshot.governance ?? null
  };
}

function stringFromJson(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function subscriptionStatusFromJson(value: Json | undefined): OrganizationSubscriptionActionStatus {
  return value === "trial" || value === "expired" || value === "suspended" || value === "cancelled" ? value : "active";
}

function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value?.length)) as Record<string, string[]>
  };
}

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function revalidateOrganizationPaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin/approvals");
  revalidatePath("/super-admin/audit-logs");
  revalidatePath("/super-admin/subscriptions");
}
