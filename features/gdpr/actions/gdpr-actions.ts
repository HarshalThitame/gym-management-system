"use server";

import { headers } from "next/headers";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { getClientIpFromHeaders } from "@/lib/security/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createExportRequest,
  getUserExportRequests,
  collectUserData,
  completeExportRequest,
  failExportRequest,
  createDeletionRequest,
  getUserDeletionRequests,
  reviewDeletionRequest,
  executeDeletion,
  getUserConsents,
  getConsentTypes,
  updateConsent,
  hasConsent,
  getProcessingRecords,
  getBreachRecords,
  createBreachRecord
} from "../services/gdpr-service";
import type { AuthActionState } from "@/features/auth/actions/action-state";

// User-facing actions
export async function requestDataExportAction(_prevState: AuthActionState): Promise<AuthActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "You must be signed in." };

    // Check if there's a pending request
    const existing = await getUserExportRequests(user.id);
    const pending = existing.find((r) => r.status === "pending" || r.status === "processing");
    if (pending) return { status: "error", message: "You already have a pending export request." };

    const request = await createExportRequest(user.id);

    // Process the export
    try {
      const data = await collectUserData(user.id);
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });

      // In a real app, upload to storage and get URL
      // For now, we'll mark as completed with a placeholder
      await completeExportRequest(request.id, "/api/gdpr/download/" + request.id);

      await writeAuditLog({
        actorId: user.id,
        action: "gdpr.data_exported",
        entityType: "gdpr_export_request",
        entityId: request.id
      });

      return { status: "success", message: "Your data export is ready for download." };
    } catch (err) {
      await failExportRequest(request.id, err instanceof Error ? err.message : "Unknown error");
      return { status: "error", message: "Failed to generate data export." };
    }
  } catch (error) {
    console.error("[GDPR] Export error:", error);
    return { status: "error", message: "Failed to process export request." };
  }
}

export async function requestAccountDeletionAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "You must be signed in." };

    const reason = formData.get("reason") as string;

    const existing = await getUserDeletionRequests(user.id);
    const pending = existing.find((r) => ["pending", "reviewing", "approved", "processing"].includes(r.status));
    if (pending) return { status: "error", message: "You already have a pending deletion request." };

    await createDeletionRequest(user.id, reason);

    await writeAuditLog({
      actorId: user.id,
      action: "gdpr.deletion_requested",
      entityType: "gdpr_deletion_request",
      metadata: { reason }
    });

    return { status: "success", message: "Your account deletion request has been submitted. We'll review it within 30 days." };
  } catch (error) {
    console.error("[GDPR] Deletion request error:", error);
    return { status: "error", message: "Failed to submit deletion request." };
  }
}

export async function updateConsentAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "You must be signed in." };

    const consentType = formData.get("consentType") as string;
    const granted = formData.get("granted") === "true";

    if (!consentType) return { status: "error", message: "Consent type is required." };

    const requestHeaders = await headers();
    await updateConsent(user.id, consentType, granted, {
      ipAddress: getClientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? undefined
    });

    await writeAuditLog({
      actorId: user.id,
      action: granted ? "gdpr.consent_granted" : "gdpr.consent_withdrawn",
      entityType: "gdpr_consent",
      metadata: { consentType }
    });

    return { status: "success", message: granted ? "Consent granted." : "Consent withdrawn." };
  } catch (error) {
    console.error("[GDPR] Consent error:", error);
    return { status: "error", message: "Failed to update consent." };
  }
}

// Admin-facing actions
export async function adminGetExportRequestsAction() {
  await requireGymAdminScope("/admin/gdpr");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gdpr_export_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminGetDeletionRequestsAction() {
  await requireGymAdminScope("/admin/gdpr");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gdpr_deletion_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminReviewDeletionAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/gdpr");
  const requestId = formData.get("requestId") as string;
  const approved = formData.get("approved") === "true";
  const rejectionReason = formData.get("rejectionReason") as string;

  if (!requestId) return { status: "error", message: "Request ID is required." };

  try {
    await reviewDeletionRequest(requestId, scope.userId, approved, rejectionReason);

    await writeAuditLog({
      actorId: scope.userId,
      action: approved ? "gdpr.deletion_approved" : "gdpr.deletion_rejected",
      entityType: "gdpr_deletion_request",
      entityId: requestId,
      metadata: { rejectionReason }
    });

    return { status: "success", message: approved ? "Deletion request approved." : "Deletion request rejected." };
  } catch (error) {
    console.error("[GDPR] Review error:", error);
    return { status: "error", message: "Failed to review request." };
  }
}

export async function adminExecuteDeletionAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/gdpr");
  const requestId = formData.get("requestId") as string;

  if (!requestId) return { status: "error", message: "Request ID is required." };

  try {
    await executeDeletion(requestId);

    await writeAuditLog({
      actorId: scope.userId,
      action: "gdpr.deletion_executed",
      entityType: "gdpr_deletion_request",
      entityId: requestId
    });

    return { status: "success", message: "User data has been permanently deleted." };
  } catch (error) {
    console.error("[GDPR] Execution error:", error);
    return { status: "error", message: error instanceof Error ? error.message : "Failed to execute deletion." };
  }
}

export async function getUserConsentsAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { consents: [], consentTypes: [] };

  const [consents, consentTypes] = await Promise.all([
    getUserConsents(user.id),
    getConsentTypes()
  ]);

  return { consents, consentTypes };
}

export async function getGdprDashboardAction() {
  await requireGymAdminScope("/admin/gdpr");
  const supabase = await createSupabaseServerClient();

  const [exportRequests, deletionRequests, processingRecords, breachRecords] = await Promise.all([
    supabase.from("gdpr_export_requests").select("id, status, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("gdpr_deletion_requests").select("id, status, created_at, reason").order("created_at", { ascending: false }).limit(100),
    getProcessingRecords(),
    getBreachRecords()
  ]);

  return {
    exportRequests: exportRequests.data ?? [],
    deletionRequests: deletionRequests.data ?? [],
    processingRecords,
    breachRecords,
    stats: {
      pendingExports: (exportRequests.data ?? []).filter((r) => r.status === "pending").length,
      pendingDeletions: (deletionRequests.data ?? []).filter((r) => r.status === "pending" || r.status === "reviewing").length,
      activeProcessingRecords: processingRecords.length,
      openBreaches: breachRecords.filter((b) => b.status !== "closed").length
    }
  };
}
