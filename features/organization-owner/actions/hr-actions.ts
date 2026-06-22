"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";
import type { AuthActionState } from "@/features/auth/actions/action-state";

export type HRDocument = {
  id: string;
  organization_id: string;
  staff_id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  expiry_date: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  staff_name?: string | null;
};

export async function getHRDocuments(
  organizationId: string,
  filters?: { staffId?: string | undefined; docType?: string | undefined }
): Promise<HRDocument[]> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "hr_document_storage", actionName: "hr_docs.read" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  let query = (supabase as any)
    .from("hr_documents")
    .select("*, profiles:staff_id(full_name)")
    .eq("organization_id", ctx.organizationId);

  if (filters?.staffId) {
    query = query.eq("staff_id", filters.staffId);
  }
  if (filters?.docType) {
    query = query.eq("doc_type", filters.docType);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((doc) => {
    const profile = doc.profiles as { full_name?: string } | null;
    return {
      id: doc.id as string,
      organization_id: doc.organization_id as string,
      staff_id: doc.staff_id as string,
      doc_type: doc.doc_type as string,
      file_name: doc.file_name as string,
      file_url: doc.file_url as string,
      file_size: doc.file_size as number | null,
      content_type: doc.content_type as string | null,
      expiry_date: doc.expiry_date as string | null,
      notes: doc.notes as string | null,
      uploaded_by: doc.uploaded_by as string | null,
      created_at: doc.created_at as string,
      updated_at: doc.updated_at as string,
      staff_name: profile?.full_name ?? null,
    } as HRDocument;
  });
}

export async function getExpiringDocuments(
  organizationId: string,
  daysThreshold: number = 30
): Promise<HRDocument[]> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "hr_document_storage", actionName: "hr_docs.read_expiring" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  const todayStr = new Date().toISOString().split("T")[0];
  const thresholdStr = thresholdDate.toISOString().split("T")[0];

  const { data, error } = await (supabase as any)
    .from("hr_documents")
    .select("*, profiles:staff_id(full_name)")
    .eq("organization_id", ctx.organizationId)
    .gte("expiry_date", todayStr)
    .lte("expiry_date", thresholdStr)
    .order("expiry_date", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((doc) => {
    const profile = doc.profiles as { full_name?: string } | null;
    return {
      id: doc.id as string,
      organization_id: doc.organization_id as string,
      staff_id: doc.staff_id as string,
      doc_type: doc.doc_type as string,
      file_name: doc.file_name as string,
      file_url: doc.file_url as string,
      file_size: doc.file_size as number | null,
      content_type: doc.content_type as string | null,
      expiry_date: doc.expiry_date as string | null,
      notes: doc.notes as string | null,
      uploaded_by: doc.uploaded_by as string | null,
      created_at: doc.created_at as string,
      updated_at: doc.updated_at as string,
      staff_name: profile?.full_name ?? null,
    } as HRDocument;
  });
}

export async function uploadHRDocument(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/staff");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "hr_document_storage", actionName: "hr_docs.upload" });

    const staffId = formData.get("staffId") as string;
    const docType = formData.get("docType") as string;
    const fileName = formData.get("fileName") as string;
    const fileUrl = formData.get("fileUrl") as string;
    const fileSize = formData.get("fileSize") as string | null;
    const contentType = formData.get("contentType") as string | null;
    const expiryDate = formData.get("expiryDate") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!staffId || !docType || !fileName || !fileUrl) {
      return { ...prevState, status: "error", message: "Staff, document type, file name, and file URL are required." };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await (supabase as any).from("hr_documents").insert({
      organization_id: ctx.organizationId,
      staff_id: staffId,
      doc_type: docType,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize ? parseInt(fileSize, 10) : null,
      content_type: contentType || null,
      expiry_date: expiryDate || null,
      notes: notes || null,
      uploaded_by: ctx.userId,
    });

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.upload_hr_document",
      entityType: "hr_documents",
      entityId: null,
      metadata: { staffId, docType, fileName } as never,
    });

    revalidateOrgModules(["/organization/staff"]);
    return { ...prevState, status: "success", message: "Document uploaded." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to upload document.");
  }
}

export async function deleteHRDocument(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/staff");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "hr_document_storage", actionName: "hr_docs.delete" });

    const documentId = formData.get("documentId") as string;
    if (!documentId) {
      return { ...prevState, status: "error", message: "Document ID is required." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: doc } = await (supabase as any).from("hr_documents")
      .select("id, file_url")
      .eq("id", documentId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (doc?.file_url) {
      try {
        const adminClient = (await import("@/lib/supabase/admin")).getSupabaseAdminClient();
        if (adminClient) {
          const urlPath = new URL(doc.file_url as string).pathname;
          const pathParts = urlPath.split("/").slice(4).join("/");
          if (pathParts) {
            await adminClient.storage.from("hr-documents").remove([pathParts]);
          }
        }
      } catch {
        // Non-fatal: storage cleanup failed, but DB record should still be removed
      }
    }

    const { error } = await (supabase as any).from("hr_documents")
      .delete()
      .eq("id", documentId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.delete_hr_document",
      entityType: "hr_documents",
      entityId: documentId,
    });

    revalidateOrgModules(["/organization/staff"]);
    return { ...prevState, status: "success", message: "Document deleted." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to delete document.");
  }
}
