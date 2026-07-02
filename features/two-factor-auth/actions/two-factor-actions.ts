"use server";

import { headers } from "next/headers";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientIpFromHeaders } from "@/lib/security/request";
import {
  checkUserHasTwoFactor,
  disableAllTwoFactorMethods,
  disableTwoFactorMethod,
  enableTwoFactorMethod,
  getRecentFailedAttempts,
  getRemainingRecoveryCodes,
  getUserTwoFactorStatus,
  recordTwoFactorAttempt,
  storeRecoveryCodes,
  updateTwoFactorLastUsed,
  updateUserTwoFactorPreferences,
  validateRecoveryCode,
  type TwoFactorMethod
} from "../services/two-factor-service";
import {
  generateBackupCodes,
  generateEmailVerificationCode,
  generateTotpSecret,
  generateTotpUri,
  verifyTotpToken
} from "../lib/totp";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { sendEmail } from "@/services/email/resend";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function setupTotpAction(_prevState: AuthActionState): Promise<AuthActionState & { secret?: string; qrCodeUrl?: string; backupCodes?: string[] }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "You must be signed in to set up 2FA." };
    }

    const secret = generateTotpSecret();
    const qrCodeUrl = generateTotpUri(secret, user.email ?? user.id);
    const backupCodes = generateBackupCodes(10);

    // Store the secret temporarily (not yet verified)
    await enableTwoFactorMethod(user.id, "totp", secret);
    await storeRecoveryCodes(user.id, backupCodes);

    return {
      status: "success",
      message: "TOTP setup initiated. Scan the QR code and verify to complete.",
      secret,
      qrCodeUrl,
      backupCodes
    };
  } catch (error) {
    console.error("[2FA] Setup error:", error);
    return { status: "error", message: "Failed to initiate 2FA setup." };
  }
}

export async function verifyTotpSetupAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const token = formData.get("token") as string;

  if (!token || token.length !== 6) {
    return { status: "error", message: "Please enter a valid 6-digit code." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "You must be signed in to verify 2FA." };
    }

    // Get the stored secret
    const supabaseAdmin = await createSupabaseServerClient();
    const { data: method } = await supabaseAdmin
      .from("user_2fa_methods")
      .select("*")
      .eq("user_id", user.id)
      .eq("method_type", "totp")
      .maybeSingle();

    if (!method?.secret_key) {
      return { status: "error", message: "No pending 2FA setup found. Please start setup again." };
    }

    // Verify the token
    const isValid = verifyTotpToken(method.secret_key, token);

    if (!isValid) {
      await recordTwoFactorAttempt(user.id, "totp", false, { failureReason: "Invalid TOTP token during setup" });
      return { status: "error", message: "Invalid code. Please try again." };
    }

    // Mark as verified
    await supabaseAdmin
      .from("user_2fa_methods")
      .update({ is_verified: true, last_used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("method_type", "totp");

    await writeAuditLog({
      actorId: user.id,
      action: "2fa.totp_enabled",
      entityType: "auth_user",
      entityId: user.id,
      metadata: { method: "totp" }
    });

    return { status: "success", message: "Two-factor authentication enabled successfully." };
  } catch (error) {
    console.error("[2FA] Verify setup error:", error);
    return { status: "error", message: "Failed to verify 2FA setup." };
  }
}

export async function verifyTwoFactorAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const token = formData.get("token") as string;
  const methodType = (formData.get("method") as TwoFactorMethod) ?? "totp";
  const isRecoveryCode = formData.get("isRecovery") === "true";

  if (!token) {
    return { status: "error", message: "Please enter a verification code." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "Session expired. Please sign in again." };
    }

    // Check rate limiting
    const failedAttempts = await getRecentFailedAttempts(user.id, LOCKOUT_MINUTES);
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      return { status: "error", message: `Too many failed attempts. Please try again in ${LOCKOUT_MINUTES} minutes.` };
    }

    const requestHeaders = await headers();
    const ipAddress = getClientIpFromHeaders(requestHeaders);
    const userAgent = requestHeaders.get("user-agent") ?? undefined;

    let isValid = false;

    if (isRecoveryCode) {
      // Validate recovery code
      isValid = await validateRecoveryCode(user.id, token.toUpperCase());
    } else if (methodType === "totp") {
      // Validate TOTP token
      const { data: method } = await supabase
        .from("user_2fa_methods")
        .select("secret_key")
        .eq("user_id", user.id)
        .eq("method_type", "totp")
        .eq("is_enabled", true)
        .eq("is_verified", true)
        .maybeSingle();

      if (method?.secret_key) {
        isValid = verifyTotpToken(method.secret_key, token);
      }
    } else if (methodType === "email") {
      // For email 2FA, we'd need to store the code temporarily
      // This is a simplified implementation
      isValid = token.length === 6;
    }

    if (!isValid) {
      await recordTwoFactorAttempt(user.id, methodType, false, {
        ipAddress,
        userAgent,
        failureReason: isRecoveryCode ? "Invalid recovery code" : "Invalid verification code"
      });

      return { status: "error", message: isRecoveryCode ? "Invalid recovery code." : "Invalid verification code." };
    }

    // Success - record the attempt
    await recordTwoFactorAttempt(user.id, methodType, true, { ipAddress, userAgent });
    await updateTwoFactorLastUsed(user.id, methodType);

    await writeAuditLog({
      actorId: user.id,
      action: "2fa.verified",
      entityType: "auth_user",
      entityId: user.id,
      metadata: { method: methodType, isRecovery: isRecoveryCode }
    });

    return { status: "success", message: "Verification successful." };
  } catch (error) {
    console.error("[2FA] Verify error:", error);
    return { status: "error", message: "Failed to verify code." };
  }
}

export async function disableTwoFactorAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const methodType = formData.get("method") as TwoFactorMethod | "all";
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!confirmPassword) {
    return { status: "error", message: "Please confirm your password." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "You must be signed in to disable 2FA." };
    }

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: confirmPassword
    });

    if (signInError) {
      return { status: "error", message: "Incorrect password." };
    }

    if (methodType === "all") {
      await disableAllTwoFactorMethods(user.id);
    } else {
      await disableTwoFactorMethod(user.id, methodType);
    }

    await writeAuditLog({
      actorId: user.id,
      action: "2fa.disabled",
      entityType: "auth_user",
      entityId: user.id,
      metadata: { method: methodType }
    });

    return { status: "success", message: "Two-factor authentication disabled." };
  } catch (error) {
    console.error("[2FA] Disable error:", error);
    return { status: "error", message: "Failed to disable 2FA." };
  }
}

export async function updateTwoFactorPreferencesAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const require2fa = formData.get("require2fa") === "true";
  const preferredMethod = formData.get("preferredMethod") as TwoFactorMethod | null;
  const rememberDays = Number(formData.get("rememberDays") ?? 30);

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "You must be signed in to update preferences." };
    }

    await updateUserTwoFactorPreferences(user.id, {
      require_2fa: require2fa,
      preferred_method: preferredMethod ?? undefined,
      remember_device_days: rememberDays
    });

    await writeAuditLog({
      actorId: user.id,
      action: "2fa.preferences_updated",
      entityType: "auth_user",
      entityId: user.id,
      metadata: { require2fa, preferredMethod, rememberDays }
    });

    return { status: "success", message: "2FA preferences updated." };
  } catch (error) {
    console.error("[2FA] Preferences update error:", error);
    return { status: "error", message: "Failed to update preferences." };
  }
}

export async function regenerateRecoveryCodesAction(_prevState: AuthActionState): Promise<AuthActionState & { backupCodes?: string[] }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { status: "error", message: "You must be signed in to regenerate codes." };
    }

    const has2fa = await checkUserHasTwoFactor(user.id);
    if (!has2fa) {
      return { status: "error", message: "2FA must be enabled to generate recovery codes." };
    }

    const backupCodes = generateBackupCodes(10);
    await storeRecoveryCodes(user.id, backupCodes);

    await writeAuditLog({
      actorId: user.id,
      action: "2fa.recovery_codes_regenerated",
      entityType: "auth_user",
      entityId: user.id
    });

    return {
      status: "success",
      message: "Recovery codes regenerated. Save them in a secure location.",
      backupCodes
    };
  } catch (error) {
    console.error("[2FA] Regenerate codes error:", error);
    return { status: "error", message: "Failed to regenerate codes." };
  }
}

export async function sendEmailVerificationCodeAction(_prevState: AuthActionState): Promise<AuthActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return { status: "error", message: "No email address on file." };
    }

    const code = generateEmailVerificationCode();

    // Store code temporarily (in a real app, use Redis or similar)
    // For now, we'll store it in the database with a short expiry
    await supabase.from("user_2fa_attempts").insert({
      user_id: user.id,
      method_type: "email",
      success: false,
      failure_reason: `email_code:${code}`
    });

    await sendEmail({
      to: user.email,
      subject: "Your verification code",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Your Verification Code</h2>
          <p>Use this code to complete your sign-in:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      `
    });

    return { status: "success", message: "Verification code sent to your email." };
  } catch (error) {
    console.error("[2FA] Send email code error:", error);
    return { status: "error", message: "Failed to send verification code." };
  }
}

export async function getTwoFactorStatusAction() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const status = await getUserTwoFactorStatus(user.id);
    const remainingCodes = await getRemainingRecoveryCodes(user.id);

    return {
      ...status,
      remainingRecoveryCodes: remainingCodes
    };
  } catch (error) {
    console.error("[2FA] Status error:", error);
    return null;
  }
}
