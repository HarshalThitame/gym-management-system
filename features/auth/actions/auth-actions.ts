"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { welcomeEmail, passwordChangedEmail } from "@/emails/auth";
import { writeAuditLog } from "@/lib/audit";
import { getRoleRedirect } from "@/lib/rbac";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";
import { sendEmail } from "@/services/email/resend";
import type { Database } from "@/types/database";
import { isRoleName, type RoleName } from "@/types/auth";
import {
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResendVerificationSchema,
  ResetPasswordSchema,
  SignInSchema,
  SignUpSchema
} from "../schemas/auth";
import type { AuthActionState } from "./action-state";

export async function signInAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const rateLimit = await checkAuthRateLimit("signin", parsed.data.email, 8);
  if (!rateLimit.allowed) {
    return errorState("Too many sign-in attempts. Wait a minute and try again.");
  }

  const supabase = await createAuthClientOrNull();

  if (!supabase) {
    return errorState("Authentication is not configured. Add Supabase environment variables first.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error || !data.user) {
    await writeAuditLog({
      actorId: null,
      action: "auth.login_failed",
      entityType: "auth_user",
      metadata: { email: parsed.data.email }
    });

    return errorState("Invalid email or password.");
  }

  await writeAuditLog({
    actorId: data.user.id,
    action: "auth.login",
    entityType: "auth_user",
    entityId: data.user.id
  });

  const nextPath = sanitizeRedirectPath(parsed.data.next, await resolveUserRedirect(supabase, data.user.id));
  redirect(nextPath);
}

export async function signUpAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = SignUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const rateLimit = await checkAuthRateLimit("signup", parsed.data.email, 5);
  if (!rateLimit.allowed) {
    return errorState("Too many registration attempts. Wait a minute and try again.");
  }

  const supabase = await createAuthClientOrNull();

  if (!supabase) {
    return errorState("Authentication is not configured. Add Supabase environment variables first.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone
      },
      emailRedirectTo: absoluteUrl("/auth/callback?next=/member")
    }
  });

  if (error) {
    return errorState("We could not create that account. Use a different email or contact the gym team.");
  }

  await Promise.all([
    writeAuditLog({
      actorId: data.user?.id ?? null,
      action: "auth.register",
      entityType: "auth_user",
      entityId: data.user?.id ?? null,
      metadata: { email: parsed.data.email }
    }),
    sendEmail({
      to: parsed.data.email,
      subject: "Welcome to Apex Performance Club",
      html: welcomeEmail(parsed.data.fullName)
    })
  ]);

  return successState("Account created. Check your inbox to verify your email before signing in.");
}

export async function forgotPasswordAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = ForgotPasswordSchema.safeParse({
    email: formData.get("email")
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const rateLimit = await checkAuthRateLimit("forgot-password", parsed.data.email, 4);
  if (!rateLimit.allowed) {
    return successState("If an account exists for that email, a password reset link has been sent.");
  }

  const supabase = await createAuthClientOrNull();

  if (!supabase) {
    return errorState("Authentication is not configured. Add Supabase environment variables first.");
  }

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absoluteUrl("/auth/callback?next=/reset-password")
  });

  return successState("If an account exists for that email, a password reset link has been sent.");
}

export async function resetPasswordAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const supabase = await createAuthClientOrNull();

  if (!supabase) {
    return errorState("Authentication is not configured. Add Supabase environment variables first.");
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return errorState("Your reset session is invalid or expired. Request a new password reset link.");
  }

  const actorId = claimsData?.claims?.sub ?? null;
  await writeAuditLog({
    actorId,
    action: "auth.password_reset",
    entityType: "auth_user",
    entityId: actorId
  });

  return successState("Password updated. You can continue to your dashboard.");
}

export async function changePasswordAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = ChangePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const supabase = await createAuthClientOrNull();

  if (!supabase) {
    return errorState("Authentication is not configured. Add Supabase environment variables first.");
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: userData, error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return errorState("We could not update your password. Sign in again and retry.");
  }

  const actorId = claimsData?.claims?.sub ?? userData.user?.id ?? null;
  await Promise.all([
    writeAuditLog({
      actorId,
      action: "auth.password_changed",
      entityType: "auth_user",
      entityId: actorId
    }),
    userData.user?.email
      ? sendEmail({
          to: userData.user.email,
          subject: "Your Apex password was changed",
          html: passwordChangedEmail(userData.user.user_metadata.full_name as string | "")
        })
      : Promise.resolve({ sent: false, reason: "No email on user." })
  ]);

  return successState("Password changed.");
}

export async function resendVerificationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = ResendVerificationSchema.safeParse({
    email: formData.get("email")
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const rateLimit = await checkAuthRateLimit("resend-verification", parsed.data.email, 4);
  if (!rateLimit.allowed) {
    return successState("If the account is pending verification, a new verification email has been sent.");
  }

  const supabase = await createAuthClientOrNull();

  if (!supabase) {
    return errorState("Authentication is not configured. Add Supabase environment variables first.");
  }

  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: absoluteUrl("/auth/callback?next=/member")
    }
  });

  return successState("If the account is pending verification, a new verification email has been sent.");
}

export async function signOutAction() {
  const supabase = await createAuthClientOrNull();

  if (supabase) {
    const { data: claimsData } = await supabase.auth.getClaims();
    const actorId = claimsData?.claims?.sub ?? null;

    await Promise.all([
      writeAuditLog({
        actorId,
        action: "auth.logout",
        entityType: "auth_user",
        entityId: actorId
      }),
      supabase.auth.signOut()
    ]);
  }

  redirect("/login");
}

async function resolveUserRedirect(supabase: SupabaseClient<Database>, userId: string) {
  const serviceRoleNames = await resolveUserRoleNamesWithServiceRole(userId);

  if (serviceRoleNames.length > 0) {
    return getRoleRedirect(serviceRoleNames);
  }

  const { data: assignments } = await supabase.from("user_roles").select("role_id").eq("user_id", userId);
  const roleIds = assignments?.map((assignment) => assignment.role_id) ?? [];

  if (roleIds.length === 0) {
    return "/member";
  }

  const { data: roles } = await supabase.from("roles").select("id,name").in("id", roleIds);
  const roleNames = (roles ?? [])
    .map((role) => role.name)
    .filter(isRoleName);

  return getRoleRedirect(roleNames);
}

async function resolveUserRoleNamesWithServiceRole(userId: string) {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url || !serviceKey) {
    return [];
  }

  const endpoint = new URL("/rest/v1/user_roles", url);
  endpoint.searchParams.set("select", "roles(name)");
  endpoint.searchParams.set("user_id", `eq.${userId}`);

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`
      }
    });

    if (!response.ok) {
      return [];
    }

    const assignments = await response.json() as Array<{ roles?: { name?: string | null } | null }>;
    return assignments
      .map((assignment) => assignment.roles?.name)
      .filter((roleName): roleName is RoleName => typeof roleName === "string" && isRoleName(roleName));
  } catch {
    return [];
  }
}

async function createAuthClientOrNull() {
  try {
    return await createSupabaseServerClient();
  } catch {
    return null;
  }
}

async function checkAuthRateLimit(action: string, identifier: string, limit: number) {
  const requestHeaders = await headers();
  const ip = getClientIpFromHeaders(requestHeaders);
  return checkRateLimit(`auth:${action}:${ip}:${identifier.toLowerCase()}`, limit, 60_000);
}

function validationState(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): AuthActionState {
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors
  };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message };
}

function successState(message: string): AuthActionState {
  return { status: "success", message };
}
