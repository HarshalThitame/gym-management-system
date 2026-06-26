"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { isMfaFreshEnough } from "@/features/super-admin/lib/organization-governance";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import {
  startBackupSchema,
  deleteBackupSchema,
  initiateRecoverySchema,
  approveRecoverySchema,
  saveBackupScheduleSchema,
  deleteBackupScheduleSchema,
  runVerificationSchema,
  generateComplianceSchema,
} from "../schemas/backup-schemas";

const superAdminRoles = ["super_admin"] as const;
const criticalMfaCookie = "super_admin_mfa_verified_at";

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, v]) => v?.length)) as Record<string, string[]>,
  };
}

function revalidatePaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/backups");
}

async function verifyMfaStepUp(stepUpEmail: string): Promise<AuthActionState | null> {
  const email = getCriticalSuperAdminEmail();
  if (stepUpEmail.trim().toLowerCase() !== email) {
    return fieldError("stepUpEmail", `Type ${email} to pass the step-up identity check.`);
  }

  const supabase = await createSupabaseServerClient();
  const mfaResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaResult.data?.currentLevel !== "aal2") {
    return { status: "error", message: "MFA step-up required. Go to /super-admin/security/mfa first.", fieldErrors: { stepUpEmail: ["Verify MFA first."] } };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaCookie)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return { status: "error", message: "MFA session expired. Verify a fresh code.", fieldErrors: { stepUpEmail: ["Re-verify MFA within 10 minutes."] } };
  }

  return null;
}

export async function startBackupAction(input: unknown): Promise<AuthActionState> {
  const parsed = startBackupSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:start:${auth.context.userId}`, 5, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  const mfaErr = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaErr) return mfaErr;

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    const { data, error } = await db
      .from("backup_jobs")
      .insert({
        backup_type: parsed.data.backupType,
        scope: parsed.data.scope,
        organization_id: parsed.data.organizationId ?? null,
        branch_id: parsed.data.branchId ?? null,
        status: "queued",
        requested_by: auth.context.userId,
        storage_tier: "hot",
        region: "primary",
        environment: "production",
        is_immutable: false,
        encryption_status: "aes256",
        verification_status: "pending",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "backup.created",
      entityType: "backup_jobs",
      entityId: data.id,
      metadata: { backupType: parsed.data.backupType, scope: parsed.data.scope },
    });

    revalidatePaths();
    return { status: "success", message: `Backup job ${data.id.slice(0, 8)} queued successfully.` };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to start backup." };
  }
}

export async function deleteBackupAction(input: unknown): Promise<AuthActionState> {
  const parsed = deleteBackupSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:delete:${auth.context.userId}`, 5, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  const mfaErr = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaErr) return mfaErr;

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    const { data: existing, error: fetchError } = await db
      .from("backup_jobs")
      .select("status")
      .eq("id", parsed.data.backupId)
      .single();

    if (fetchError || !existing) return { status: "error", message: "Backup job not found." };

    if (existing.status === "running" || existing.status === "queued") {
      return { status: "error", message: "Cannot delete a running or queued backup." };
    }

    const { error } = await db
      .from("backup_jobs")
      .delete()
      .eq("id", parsed.data.backupId);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "backup.deleted",
      entityType: "backup_jobs",
      entityId: parsed.data.backupId,
      metadata: { reason: parsed.data.reason },
    });

    revalidatePaths();
    return { status: "success", message: "Backup deleted successfully." };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to delete backup." };
  }
}

export async function initiateRecoveryAction(input: unknown): Promise<AuthActionState> {
  const parsed = initiateRecoverySchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:recover:${auth.context.userId}`, 3, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  const mfaErr = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaErr) return mfaErr;

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    const { data: backup, error: backupError } = await db
      .from("backup_jobs")
      .select("id, status")
      .eq("id", parsed.data.backupId)
      .single();

    if (backupError || !backup) return { status: "error", message: "Backup not found." };
    if (backup.status !== "completed") return { status: "error", message: "Can only recover from completed backups." };

    const sessionNumber = crypto.randomUUID().slice(0, 8);

    const { data: session, error: sessionError } = await db
      .from("recovery_sessions")
      .insert({
        session_number: sessionNumber,
        recovery_type: parsed.data.recoveryType,
        status: "pending",
        backup_job_id: parsed.data.backupId,
        scope: parsed.data.scope,
        organization_id: parsed.data.organizationId ?? null,
        branch_id: parsed.data.branchId ?? null,
        recovery_point: parsed.data.pitrTimestamp ?? new Date().toISOString(),
        pitr_point_id: parsed.data.pitrPointId ?? null,
        requested_by: auth.context.userId,
        risk_assessment: "pending",
      })
      .select("id")
      .single();

    if (sessionError) throw new Error(sessionError.message);

    const { error: approvalError } = await db
      .from("recovery_approvals")
      .insert({
        recovery_session_id: session.id,
        approval_level: 1,
        approver_role: "super_admin",
        status: "pending",
        mfa_verified: false,
      });

    if (approvalError) throw new Error(approvalError.message);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "recovery.initiated",
      entityType: "recovery_sessions",
      entityId: session.id,
      metadata: { backupId: parsed.data.backupId, recoveryType: parsed.data.recoveryType },
    });

    revalidatePaths();
    return { status: "success", message: `Recovery session #${sessionNumber} initiated.`, success: true };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to initiate recovery." };
  }
}

export async function approveRecoveryAction(input: unknown): Promise<AuthActionState> {
  const parsed = approveRecoverySchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:approve:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  const mfaErr = await verifyMfaStepUp(parsed.data.stepUpEmail);
  if (mfaErr) return mfaErr;

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    const { data: existingApproval, error: fetchError } = await db
      .from("recovery_approvals")
      .select("id, status")
      .eq("recovery_session_id", parsed.data.recoveryId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);

    if (existingApproval) {
      const { error: updateError } = await db
        .from("recovery_approvals")
        .update({
          status: parsed.data.decision === "approve" ? "approved" : parsed.data.decision === "reject" ? "rejected" : "escalated",
          review_notes: parsed.data.reviewNote ?? null,
          mfa_verified: true,
          responded_at: new Date().toISOString(),
        })
        .eq("id", existingApproval.id);

      if (updateError) throw new Error(updateError.message);
    }

    if (parsed.data.decision === "approve") {
      await db.from("recovery_sessions").update({ status: "approved" }).eq("id", parsed.data.recoveryId);
    } else if (parsed.data.decision === "reject") {
      await db.from("recovery_sessions").update({ status: "cancelled" }).eq("id", parsed.data.recoveryId);
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      action: `recovery.${parsed.data.decision}d`,
      entityType: "recovery_approvals",
      entityId: existingApproval?.id ?? parsed.data.recoveryId,
      metadata: { recoveryId: parsed.data.recoveryId, decision: parsed.data.decision },
    });

    revalidatePaths();
    return { status: "success", message: `Recovery ${parsed.data.decision}d successfully.` };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to process approval." };
  }
}

export async function saveBackupScheduleAction(input: unknown): Promise<AuthActionState> {
  const parsed = saveBackupScheduleSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:schedule:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    if (parsed.data.scheduleId) {
      const { error } = await db
        .from("backup_schedules")
        .update({
          schedule_name: parsed.data.name,
          backup_type: parsed.data.backupType,
          frequency: parsed.data.frequency,
          custom_cron: parsed.data.customCron ?? null,
          retention_days: parsed.data.retentionDays,
          storage_tier: parsed.data.storageTier,
          is_active: parsed.data.isActive,
          preferred_window_start: parsed.data.preferredWindowStart ?? null,
          preferred_window_end: parsed.data.preferredWindowEnd ?? null,
        })
        .eq("id", parsed.data.scheduleId);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("backup_schedules")
        .insert({
          schedule_name: parsed.data.name,
          backup_type: parsed.data.backupType,
          scope: "platform",
          frequency: parsed.data.frequency,
          custom_cron: parsed.data.customCron ?? null,
          retention_days: parsed.data.retentionDays,
          storage_tier: parsed.data.storageTier,
          is_active: parsed.data.isActive,
          preferred_window_start: parsed.data.preferredWindowStart ?? null,
          preferred_window_end: parsed.data.preferredWindowEnd ?? null,
        });

      if (error) throw new Error(error.message);
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      action: `backup_schedule.${parsed.data.scheduleId ? "updated" : "created"}`,
      entityType: "backup_schedules",
      metadata: { name: parsed.data.name, backupType: parsed.data.backupType },
    });

    revalidatePaths();
    return { status: "success", message: `Schedule "${parsed.data.name}" saved.` };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to save schedule." };
  }
}

export async function deleteBackupScheduleAction(input: unknown): Promise<AuthActionState> {
  const parsed = deleteBackupScheduleSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:schedule:delete:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    const { error } = await db
      .from("backup_schedules")
      .delete()
      .eq("id", parsed.data.scheduleId);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "backup_schedule.deleted",
      entityType: "backup_schedules",
      entityId: parsed.data.scheduleId,
    });

    revalidatePaths();
    return { status: "success", message: "Schedule deleted." };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to delete schedule." };
  }
}

export async function runBackupVerificationAction(input: unknown): Promise<AuthActionState> {
  const parsed = runVerificationSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:verify:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    const { data, error } = await db
      .from("backup_verifications")
      .insert({
        backup_job_id: parsed.data.backupId,
        verification_type: parsed.data.verificationType,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "backup_verification.started",
      entityType: "backup_verifications",
      entityId: data.id,
      metadata: { backupId: parsed.data.backupId, verificationType: parsed.data.verificationType },
    });

    revalidatePaths();
    return { status: "success", message: "Verification started." };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to start verification." };
  }
}

export async function generateComplianceReportAction(input: unknown): Promise<AuthActionState> {
  const parsed = generateComplianceSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  const rateCheck = await checkRateLimit(`backup:compliance:${auth.context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) return { status: "error", message: `Rate limited. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };

  try {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;

    const { data, error } = await db
      .from("backup_compliance_reports")
      .insert({
        report_type: parsed.data.reportType,
        title: `Compliance Report - ${parsed.data.reportType}`,
        status: "generating",
        period_start: parsed.data.periodStart,
        period_end: parsed.data.periodEnd,
        organization_id: parsed.data.organizationId ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "compliance_report.generated",
      entityType: "backup_compliance_reports",
      entityId: data.id,
      metadata: { reportType: parsed.data.reportType },
    });

    revalidatePaths();
    return { status: "success", message: "Compliance report generation started." };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to generate compliance report." };
  }
}
