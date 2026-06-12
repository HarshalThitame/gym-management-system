"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderBrandedEmail } from "@/emails/auth";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/services/email/resend";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { isMfaFreshEnough } from "@/features/super-admin/lib/organization-governance";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import {
  bulkUserActionSchema,
  forceLogoutUserSchema,
  inviteUserSchema,
  resetUserPasswordSchema,
  transferUserRoleSchema,
  updateUserStatusSchema
} from "../schemas/user-management-schemas";
import type { Database } from "@/types/database";

const superAdminRoles = ["super_admin"] as const;
const criticalMfaFreshnessCookieName = "super_admin_mfa_verified_at";
const resetPasswordUrl = "/reset-password";



type AuthAdminClient = SupabaseClient<Database> & {
  auth: {
    admin: {
      createUser(params: {
        email: string;
        password: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, unknown>;
      }): Promise<{ data: { user: { id: string } | null } | null; error: { message: string } | null }>;
      generateLink(params: { type: "signup" | "magiclink" | "recovery" | "invite"; email: string }): Promise<{
        data: { properties: { action_link: string } } | null;
        error: { message: string } | null;
      }>;
      deleteUser(id: string): Promise<{ error: { message: string } | null }>;
      listUsers(): Promise<{ data: { users: Array<{ id: string; email?: string }> } | null; error: { message: string } | null }>;
    };
  };
};

export async function inviteUserAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    organizationId: formData.get("organizationId"),
    gymId: formData.get("gymId") ?? "",
    branchId: formData.get("branchId") ?? "",
    phone: formData.get("phone") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("email", parsed.data.email.toLowerCase().trim())
    .maybeSingle();

  if (existing) {
    if (existing.status === "active" || existing.status === "invited") {
      return { status: "error", message: "A user with this email already exists." };
    }
  }

  const tempPassword = crypto.randomUUID().slice(0, 16);
  const adminClient = supabase as AuthAdminClient;
  const authResult = await adminClient.auth.admin.createUser({
    email: parsed.data.email.toLowerCase().trim(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName, invited_by: context.userId }
  });

  if (authResult.error) {
    return { status: "error", message: authResult.error.message };
  }

  const authUserId = authResult.data?.user?.id;
  if (!authUserId) {
    return { status: "error", message: "User creation failed. No user ID returned." };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: authUserId,
    full_name: parsed.data.fullName,
    email: parsed.data.email.toLowerCase().trim(),
    phone: parsed.data.phone || null,
    status: "active"
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUserId).catch(() => {});
    return { status: "error", message: profileError.message };
  }

  if (parsed.data.branchId) {
    const { error: assignmentError } = await supabase.from("branch_users").insert({
      organization_id: parsed.data.organizationId,
      branch_id: parsed.data.branchId,
      user_id: authUserId,
      role_name: parsed.data.role,
      branch_role: roleToBranchRole(parsed.data.role) as "trainer" | "owner" | "admin" | "manager" | "staff" | "viewer",
      access_scope: "single_branch",
      status: "active",
      permissions: { scope: "branch", invitedBy: context.userId },
      assigned_by: context.userId
    });

    if (assignmentError) {
      console.error("[super-admin-users] Branch assignment failed after invite.", assignmentError.message);
    }
  }

  if (parsed.data.role !== "member") {
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: authUserId,
      role_id: parsed.data.organizationId,
      gym_id: parsed.data.gymId || null,
      assigned_by: context.userId
    });

    if (roleError) {
      console.error("[super-admin-users] User role insertion failed.", roleError.message);
    }
  }

  const inviteLink = await adminClient.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email.toLowerCase().trim()
  });

  const loginUrl = inviteLink.data?.properties?.action_link ?? process.env.NEXT_PUBLIC_SITE_URL ?? "/login";
  const emailResult = await sendEmail({
    to: parsed.data.email.toLowerCase().trim(),
    subject: "You have been invited to Apex Performance Club",
    html: renderBrandedEmail({
      title: "Welcome to Apex Performance Club",
      preview: "Your account has been created by a Super Admin.",
      body: [
        `<p>Hi ${escapeHtml(parsed.data.fullName)},</p>`,
        `<p>Your <strong>${formatRoleLabel(parsed.data.role)}</strong> account has been created by the platform Super Admin team.</p>`,
        `<p>Your temporary password is: <strong>${escapeHtml(tempPassword)}</strong></p>`,
        parsed.data.reason ? `<p><strong>Reason:</strong> ${escapeHtml(parsed.data.reason)}</p>` : "",
        `<p>Use the link below to sign in and complete your access setup.</p>`
      ].join(""),
      ctaLabel: "Sign In to Your Account",
      ctaUrl: loginUrl
    })
  });

  await writeAuditLog({
    actorId: context.userId,
    action: "user.invited",
    entityType: "profile",
    entityId: authUserId,
    metadata: {
      email: parsed.data.email.toLowerCase().trim(),
      role: parsed.data.role,
      organizationId: parsed.data.organizationId,
      reason: parsed.data.reason || null,
      emailSent: emailResult.sent
    }
  });

  revalidateUserPaths();
  return {
    status: "success",
    message: emailResult.sent
      ? `User invited. They will receive login instructions at ${parsed.data.email}.`
      : `User created but email delivery failed (${emailResult.reason}). Share temporary password securely.`
  };
}

export async function updateUserStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const parsed = updateUserStatusSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  const expectedConfirmation = parsed.data.action.toUpperCase();
  if (parsed.data.confirmation !== expectedConfirmation) {
    return fieldError("confirmation", `Type ${expectedConfirmation} to confirm.`);
  }

  const profileResult = await supabase.from("profiles").select("*").eq("id", parsed.data.userId).maybeSingle();
  if (profileResult.error) return { status: "error", message: profileResult.error.message };
  if (!profileResult.data) return { status: "error", message: "User not found." };
  const profile = profileResult.data;

  const actionToStatus: Record<string, "active" | "suspended" | "archived"> = {
    activate: "active",
    suspend: "suspended",
    archive: "archived"
  };
  const nextStatus = actionToStatus[parsed.data.action] ?? "active";

  if (profile.status === nextStatus) {
    return { status: "success", message: `User is already ${nextStatus}.` };
  }
  const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", parsed.data.userId);

  if (error) return { status: "error", message: error.message };

  await writeAuditLog({
    actorId: context.userId,
    action: `user.${parsed.data.action}d`,
    entityType: "profile",
    entityId: parsed.data.userId,
    metadata: {
      previousStatus: profile.status,
      nextStatus,
      reason: parsed.data.reason || null
    }
  });

  revalidateUserPaths();
  return { status: "success", message: `User ${parsed.data.action}d successfully.` };
}

export async function forceLogoutUserAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const parsed = forceLogoutUserSchema.safeParse({
    userId: formData.get("userId"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  if (parsed.data.confirmation !== "FORCE_LOGOUT") {
    return fieldError("confirmation", "Type FORCE_LOGOUT to confirm.");
  }

  if (parsed.data.userId === context.userId) {
    return { status: "error", message: "You cannot force logout your own session." };
  }

  const adminClient = supabase as AuthAdminClient;
  const { error } = await adminClient.auth.admin.deleteUser(parsed.data.userId);

  if (error) return { status: "error", message: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: loginError } = await (supabase as any).from("login_history").insert({
    user_id: parsed.data.userId,
    email: context.email ?? "unknown",
    status: "force_logout",
    failure_reason: parsed.data.reason || "Force logout initiated by Super Admin"
  });

  if (loginError) {
    console.error("[super-admin-users] Login history write failed for force logout.", loginError.message);
  }

  await writeAuditLog({
    actorId: context.userId,
    action: "user.force_logout",
    entityType: "profile",
    entityId: parsed.data.userId,
    metadata: {
      reason: parsed.data.reason || null,
      targetEmail: context.email
    }
  });

  revalidateUserPaths();
  return { status: "success", message: "User sessions revoked. They will be signed out on their next request." };
}

export async function resetUserPasswordAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const parsed = resetUserPasswordSchema.safeParse({
    userId: formData.get("userId"),
    email: formData.get("email"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  if (parsed.data.confirmation !== "RESET_PASSWORD") {
    return fieldError("confirmation", "Type RESET_PASSWORD to confirm.");
  }

  const adminClient = supabase as AuthAdminClient;
  const linkResult = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.email.toLowerCase().trim()
  });

  if (linkResult.error) return { status: "error", message: linkResult.error.message };

  const resetLink = linkResult.data?.properties?.action_link ?? null;

  const emailResult = await sendEmail({
    to: parsed.data.email.toLowerCase().trim(),
    subject: "Password Reset Requested by Super Admin",
    html: renderBrandedEmail({
      title: "Password Reset",
      preview: "A Super Admin has requested a password reset for your account.",
      body: [
        `<p>A platform Super Admin has initiated a password reset for your account.</p>`,
        parsed.data.reason ? `<p><strong>Reason:</strong> ${escapeHtml(parsed.data.reason)}</p>` : "",
        `<p>Use the link below to set a new password. This link expires in 1 hour.</p>`
      ].join(""),
      ctaLabel: "Reset Your Password",
      ctaUrl: resetLink ?? process.env.NEXT_PUBLIC_SITE_URL + resetPasswordUrl
    })
  });

  await writeAuditLog({
    actorId: context.userId,
    action: "user.password_reset_requested",
    entityType: "profile",
    entityId: parsed.data.userId,
    metadata: {
      email: parsed.data.email.toLowerCase().trim(),
      reason: parsed.data.reason || null,
      emailSent: emailResult.sent
    }
  });

  revalidateUserPaths();
  return {
    status: "success",
    message: emailResult.sent
      ? "Password reset email sent to the user."
      : `Password reset generated but email delivery failed (${emailResult.reason}). Share the reset link directly.`
  };
}

export async function transferUserRoleAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const parsed = transferUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    targetRole: formData.get("targetRole"),
    targetOrganizationId: formData.get("targetOrganizationId"),
    targetBranchId: formData.get("targetBranchId") ?? "",
    targetGymId: formData.get("targetGymId") ?? "",
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  if (parsed.data.confirmation !== "TRANSFER_ROLE") {
    return fieldError("confirmation", "Type TRANSFER_ROLE to confirm.");
  }

  const profile = await supabase.from("profiles").select("id, full_name, status").eq("id", parsed.data.userId).maybeSingle();
  if (profile.error || !profile.data) return { status: "error", message: "User not found." };

  if (profile.data.status === "archived" || profile.data.status === "suspended") {
    return { status: "error", message: "Cannot change role of an archived or suspended user." };
  }

  const { data: existingOrg } = await supabase.from("organizations").select("id").eq("id", parsed.data.targetOrganizationId).maybeSingle();
  if (!existingOrg) return fieldError("targetOrganizationId", "Selected organization was not found.");

  const { error: deleteOld } = await supabase
    .from("branch_users")
    .update({ status: "revoked" })
    .eq("user_id", parsed.data.userId)
    .eq("status", "active");

  if (deleteOld) return { status: "error", message: deleteOld.message };

  const { error: insertNew } = await supabase.from("branch_users").insert({
    organization_id: parsed.data.targetOrganizationId,
    branch_id: parsed.data.targetBranchId,
    user_id: parsed.data.userId,
    role_name: parsed.data.targetRole,
    branch_role: roleToBranchRole(parsed.data.targetRole) as "trainer" | "owner" | "admin" | "manager" | "staff" | "viewer",
    access_scope: parsed.data.targetRole === "super_admin" ? "organization" : "single_branch",
    status: "active",
    permissions: { scope: "role_transfer", transferredBy: context.userId },
    assigned_by: context.userId
  });

  if (insertNew) return { status: "error", message: insertNew.message };

  await writeAuditLog({
    actorId: context.userId,
    action: "user.role_transferred",
    entityType: "profile",
    entityId: parsed.data.userId,
    metadata: {
      targetRole: parsed.data.targetRole,
      targetOrganizationId: parsed.data.targetOrganizationId,
      targetGymId: parsed.data.targetGymId || null,
      reason: parsed.data.reason || null
    }
  });

  revalidateUserPaths();
  return { status: "success", message: `User role transferred to ${formatRoleLabel(parsed.data.targetRole)}.` };
}

export async function bulkUserActionAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const parsed = bulkUserActionSchema.safeParse({
    userIds: formData.getAll("userIds"),
    action: formData.get("action"),
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  if (parsed.data.confirmation !== "BULK") {
    return fieldError("confirmation", "Type BULK to confirm this bulk operation.");
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, status")
    .in("id", parsed.data.userIds);

  if (profilesError) return { status: "error", message: profilesError.message };
  if (!profiles || profiles.length === 0) return { status: "error", message: "No matching users found." };

  const action = parsed.data.action;
  const nextStatus = action === "archive" ? "archived" : action === "suspend" ? "suspended" : "active";

  let successCount = 0;
  for (const profile of profiles) {
    if (action === "force_logout") {
      const adminClient = supabase as AuthAdminClient;
      await adminClient.auth.admin.deleteUser(profile.id).catch(() => {});
    } else {
      const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", profile.id);
      if (!error) successCount++;
    }
  }

  await writeAuditLog({
    actorId: context.userId,
    action: `user.bulk_${action}`,
    entityType: "profile",
    metadata: {
      count: profiles.length,
      userIds: parsed.data.userIds,
      reason: parsed.data.reason || null
    }
  });

  revalidateUserPaths();
  return {
    status: "success",
    message: `Bulk ${action.replaceAll("_", " ")} completed for ${action === "force_logout" ? profiles.length : successCount} user(s).`
  };
}

export async function saveUserProfileAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const userId = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!userId) return { status: "error", message: "User ID is required." };
  if (fullName.length < 2) return fieldError("fullName", "Full name is required.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", userId);

  if (error) return { status: "error", message: error.message };

  await writeAuditLog({
    actorId: context.userId,
    action: "user.profile_updated",
    entityType: "profile",
    entityId: userId,
    metadata: { fullName, phone: phone || null }
  });

  revalidateUserPaths();
  return { status: "success", message: "User profile updated." };
}

async function verifyCriticalSuperAdminAccess(
  context: { userId: string | null; email: string | null; roles: string[] },
  supabase: SupabaseClient<Database>,
  value: string
): Promise<
  | { ok: true; mfa: { currentLevel: string | null; nextLevel: string | null } }
  | { ok: false; state: AuthActionState }
> {
  const email = context.email?.trim().toLowerCase() ?? null;
  const requiredEmail = getCriticalSuperAdminEmail();

  if (email !== requiredEmail) {
    return { ok: false, state: { status: "error", message: `Critical Super Admin actions must be performed from ${requiredEmail}.` } };
  }

  if (value.trim().toLowerCase() !== requiredEmail) {
    return { ok: false, state: fieldError("stepUpEmail", `Type ${requiredEmail} to pass the step-up identity check.`) };
  }

  const mfaResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = mfaResult.data?.currentLevel ?? null;

  if (currentLevel !== "aal2") {
    return { ok: false, state: { status: "error", message: "MFA verification is required. Verify MFA at /super-admin/security/mfa first.", fieldErrors: { stepUpEmail: ["Verify MFA first."] } } };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaFreshnessCookieName)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return { ok: false, state: { status: "error", message: "MFA verification is stale. Verify a fresh code.", fieldErrors: { stepUpEmail: ["Verify a fresh MFA challenge within 10 minutes."] } } };
  }

  return { ok: true, mfa: { currentLevel, nextLevel: mfaResult.data?.nextLevel ?? null } };
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, v]) => v?.length)) as Record<string, string[]>
  };
}

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function revalidateUserPaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/users");
}

function roleToBranchRole(role: string): string {
  if (role === "super_admin" || role === "organization_owner") return "owner";
  if (role === "gym_admin") return "admin";
  if (role === "trainer") return "trainer";
  if (role === "reception_staff") return "staff";
  return "member";
}

function formatRoleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
