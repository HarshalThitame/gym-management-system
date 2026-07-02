"use server";

import { headers } from "next/headers";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { getClientIpFromHeaders } from "@/lib/security/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getUserSessions,
  revokeSession,
  revokeAllSessions,
  getIpWhitelist,
  addIpToWhitelist,
  removeIpFromWhitelist,
  getPasswordPolicy,
  updatePasswordPolicy,
  validatePassword,
  checkAccountLockout,
  lockAccount,
  unlockAccount,
  getRecentFailedAttempts,
  recordLoginAttempt
} from "../services/security-service";
import type { AuthActionState } from "@/features/auth/actions/action-state";

// Session actions
export async function getMySessionsAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return getUserSessions(user.id);
}

export async function revokeSessionAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) return { status: "error", message: "Session ID required." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "Not authenticated." };

    await revokeSession(sessionId, user.id);

    await writeAuditLog({
      actorId: user.id,
      action: "security.session_revoked",
      entityType: "user_session",
      entityId: sessionId
    });

    return { status: "success", message: "Session revoked." };
  } catch (error) {
    return { status: "error", message: "Failed to revoke session." };
  }
}

export async function revokeAllSessionsAction(_prevState: AuthActionState): Promise<AuthActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "Not authenticated." };

    await revokeAllSessions(user.id);

    await writeAuditLog({
      actorId: user.id,
      action: "security.all_sessions_revoked",
      entityType: "auth_user",
      entityId: user.id
    });

    return { status: "success", message: "All other sessions have been revoked." };
  } catch (error) {
    return { status: "error", message: "Failed to revoke sessions." };
  }
}

// IP Whitelist actions
export async function adminGetIpWhitelistAction() {
  const scope = await requireGymAdminScope("/admin/security");
  return getIpWhitelist(scope.scopedOrganizationId ?? undefined, scope.gymId ?? undefined);
}

export async function adminAddIpAction(formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/security");
  const ipAddress = formData.get("ipAddress") as string;
  const label = formData.get("label") as string;

  if (!ipAddress) return { status: "error", message: "IP address required." };

  try {
    await addIpToWhitelist(ipAddress, {
      organizationId: scope.scopedOrganizationId ?? undefined,
      gymId: scope.gymId ?? undefined,
      label: label || undefined,
      createdBy: scope.userId
    });

    await writeAuditLog({
      actorId: scope.userId,
      gymId: scope.gymId,
      action: "security.ip_whitelisted",
      entityType: "ip_whitelist",
      metadata: { ipAddress, label }
    });

    return { status: "success", message: "IP added to whitelist." };
  } catch (error) {
    return { status: "error", message: "Failed to add IP." };
  }
}

export async function adminRemoveIpAction(formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/security");
  const id = formData.get("id") as string;

  if (!id) return { status: "error", message: "ID required." };

  try {
    await removeIpFromWhitelist(id);

    await writeAuditLog({
      actorId: scope.userId,
      gymId: scope.gymId,
      action: "security.ip_removed_from_whitelist",
      entityType: "ip_whitelist",
      entityId: id
    });

    return { status: "success", message: "IP removed from whitelist." };
  } catch (error) {
    return { status: "error", message: "Failed to remove IP." };
  }
}

// Password Policy actions
export async function adminGetPasswordPolicyAction() {
  const scope = await requireGymAdminScope("/admin/security");
  return getPasswordPolicy(scope.scopedOrganizationId ?? undefined);
}

export async function adminUpdatePasswordPolicyAction(formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/security");

  try {
    await updatePasswordPolicy(scope.scopedOrganizationId!, {
      min_length: Number(formData.get("minLength") ?? 12),
      require_uppercase: formData.get("requireUppercase") === "true",
      require_lowercase: formData.get("requireLowercase") === "true",
      require_numbers: formData.get("requireNumbers") === "true",
      require_special_chars: formData.get("requireSpecialChars") === "true",
      max_age_days: formData.get("maxAgeDays") ? Number(formData.get("maxAgeDays")) : null,
      prevent_reuse_count: Number(formData.get("preventReuse") ?? 5),
      max_login_attempts: Number(formData.get("maxLoginAttempts") ?? 5),
      lockout_duration_minutes: Number(formData.get("lockoutDuration") ?? 15)
    });

    await writeAuditLog({
      actorId: scope.userId,
      action: "security.password_policy_updated",
      entityType: "password_policy"
    });

    return { status: "success", message: "Password policy updated." };
  } catch (error) {
    return { status: "error", message: "Failed to update policy." };
  }
}

// Account lockout actions
export async function adminCheckLockoutAction(email: string) {
  await requireGymAdminScope("/admin/security");
  return checkAccountLockout(email);
}

export async function adminUnlockAccountAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/security");
  const email = formData.get("email") as string;

  if (!email) return { status: "error", message: "Email required." };

  try {
    await unlockAccount(email);

    await writeAuditLog({
      actorId: scope.userId,
      action: "security.account_unlocked",
      entityType: "auth_user",
      metadata: { email }
    });

    return { status: "success", message: "Account unlocked." };
  } catch (error) {
    return { status: "error", message: "Failed to unlock account." };
  }
}

// Security dashboard
export async function getSecurityDashboardAction() {
  const scope = await requireGymAdminScope("/admin/security");
  const supabase = await createSupabaseServerClient();

  const [sessions, whitelist, policy, lockouts] = await Promise.all([
    supabase.from("user_sessions").select("id", { count: "exact", head: true }).eq("is_active", true),
    getIpWhitelist(scope.scopedOrganizationId ?? undefined, scope.gymId ?? undefined),
    getPasswordPolicy(scope.scopedOrganizationId ?? undefined),
    supabase.from("account_lockouts").select("*").gt("locked_until", new Date().toISOString())
  ]);

  return {
    activeSessions: sessions.count ?? 0,
    whitelistedIps: whitelist.length,
    hasPasswordPolicy: policy !== null,
    lockedAccounts: lockouts.data?.length ?? 0
  };
}
