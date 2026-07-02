import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

export type GdprExportRequest = Database["public"]["Tables"]["gdpr_export_requests"]["Row"];
export type GdprDeletionRequest = Database["public"]["Tables"]["gdpr_deletion_requests"]["Row"];
export type GdprConsent = Database["public"]["Tables"]["gdpr_consents"]["Row"];
export type GdprConsentType = Database["public"]["Tables"]["gdpr_consent_types"]["Row"];
export type GdprProcessingRecord = Database["public"]["Tables"]["gdpr_processing_records"]["Row"];
export type GdprBreachRecord = Database["public"]["Tables"]["gdpr_breach_records"]["Row"];

export type UserDataExport = {
  profile: Record<string, unknown>;
  memberships: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  attendance: Record<string, unknown>[];
  consents: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  exportedAt: string;
};

// Export Request Functions
export async function createExportRequest(userId: string, format: "json" | "csv" | "pdf" = "json"): Promise<GdprExportRequest> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gdpr_export_requests")
    .insert({
      user_id: userId,
      requested_by: userId,
      status: "pending",
      format
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getUserExportRequests(userId: string): Promise<GdprExportRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gdpr_export_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function collectUserData(userId: string): Promise<UserDataExport> {
  const supabase = getSupabaseAdminClient();

  const [profileResult, membershipsResult, paymentsResult, attendanceResult, consentsResult, auditLogsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("memberships").select("*").eq("user_id", userId),
    supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("attendance_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5000),
    supabase.from("gdpr_consents").select("*").eq("user_id", userId),
    supabase.from("audit_logs").select("*").eq("actor_id", userId).order("created_at", { ascending: false }).limit(1000)
  ]);

  return {
    profile: (profileResult.data as Record<string, unknown>) ?? {},
    memberships: (membershipsResult.data as Record<string, unknown>[]) ?? [],
    payments: (paymentsResult.data as Record<string, unknown>[]) ?? [],
    attendance: (attendanceResult.data as Record<string, unknown>[]) ?? [],
    consents: (consentsResult.data as Record<string, unknown>[]) ?? [],
    auditLogs: (auditLogsResult.data as Record<string, unknown>[]) ?? [],
    exportedAt: new Date().toISOString()
  };
}

export async function completeExportRequest(requestId: string, downloadUrl: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("gdpr_export_requests")
    .update({
      status: "completed",
      download_url: downloadUrl,
      download_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date().toISOString()
    })
    .eq("id", requestId);
}

export async function failExportRequest(requestId: string, errorMessage: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("gdpr_export_requests")
    .update({
      status: "failed",
      error_message: errorMessage
    })
    .eq("id", requestId);
}

// Deletion Request Functions
export async function createDeletionRequest(userId: string, reason?: string): Promise<GdprDeletionRequest> {
  const supabase = await createSupabaseServerClient();

  // Collect data summary first
  const { data: summary } = await supabase.rpc("get_user_data_summary", { p_user_id: userId });

  const { data, error } = await supabase
    .from("gdpr_deletion_requests")
    .insert({
      user_id: userId,
      requested_by: userId,
      status: "pending",
      reason: reason ?? null,
      data_summary: summary ?? {}
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getUserDeletionRequests(userId: string): Promise<GdprDeletionRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gdpr_deletion_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function reviewDeletionRequest(
  requestId: string,
  reviewerId: string,
  approved: boolean,
  rejectionReason?: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("gdpr_deletion_requests")
    .update({
      status: approved ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      rejection_reason: rejectionReason ?? null
    })
    .eq("id", requestId);
}

export async function executeDeletion(requestId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: request } = await supabase
    .from("gdpr_deletion_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "approved") {
    throw new Error("Request not found or not approved");
  }

  if (request.legal_hold) {
    throw new Error("Cannot delete: legal hold is in place");
  }

  await supabase.from("gdpr_deletion_requests").update({ status: "processing" }).eq("id", requestId);

  const userId = request.user_id;

  // Delete user data in order
  await Promise.all([
    supabase.from("gdpr_consents").delete().eq("user_id", userId),
    supabase.from("attendance_sessions").delete().eq("user_id", userId),
    supabase.from("payments").delete().eq("user_id", userId),
    supabase.from("memberships").delete().eq("user_id", userId),
    supabase.from("audit_logs").update({ actor_id: null, metadata: { anonymized: true } }).eq("actor_id", userId)
  ]);

  // Anonymize profile instead of deleting (to maintain referential integrity)
  await supabase
    .from("profiles")
    .update({
      full_name: "Deleted User",
      email: `deleted_${userId}@deleted.local`,
      phone: null
    })
    .eq("id", userId);

  // Delete the auth user
  await supabase.auth.admin.deleteUser(userId);

  await supabase
    .from("gdpr_deletion_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", requestId);
}

// Consent Functions
export async function getUserConsents(userId: string): Promise<GdprConsent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gdpr_consents")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConsentTypes(): Promise<GdprConsentType[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gdpr_consent_types")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateConsent(
  userId: string,
  consentType: string,
  granted: boolean,
  metadata?: { ipAddress?: string; userAgent?: string; version?: string }
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  await supabase.from("gdpr_consents").upsert({
    user_id: userId,
    consent_type: consentType,
    granted,
    granted_at: granted ? new Date().toISOString() : null,
    withdrawn_at: !granted ? new Date().toISOString() : null,
    ip_address: metadata?.ipAddress ?? null,
    user_agent: metadata?.userAgent ?? null,
    version: metadata?.version ?? null
  }, { onConflict: "user_id,consent_type" });
}

export async function hasConsent(userId: string, consentType: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("gdpr_consents")
    .select("granted")
    .eq("user_id", userId)
    .eq("consent_type", consentType)
    .maybeSingle();

  return data?.granted ?? false;
}

// Processing Records Functions
export async function getProcessingRecords(organizationId?: string): Promise<GdprProcessingRecord[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("gdpr_processing_records").select("*").eq("is_active", true);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Breach Records Functions
export async function getBreachRecords(organizationId?: string): Promise<GdprBreachRecord[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("gdpr_breach_records").select("*");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBreachRecord(record: Partial<GdprBreachRecord>): Promise<GdprBreachRecord> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("gdpr_breach_records")
    .insert(record)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
