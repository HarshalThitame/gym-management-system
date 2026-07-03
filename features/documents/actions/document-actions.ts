"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { validateAllowedFile } from "@/lib/security/file-validation";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { requireReceptionScope } from "@/features/reception/lib/access";
import {
  buildOperationalReference,
  requireScopedDocument,
  requireScopedMember,
  toOperationErrorMessage,
} from "@/features/reception/lib/operation-guards";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxFileBytes = 10 * 1024 * 1024;

function errorState(message: string): AuthActionState {
  return { status: "error", message, success: false };
}

function successState(message: string): AuthActionState {
  return { status: "success", message, success: true };
}

export async function uploadDocumentAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/documents");

  const memberId = formData.get("memberId") as string;
  const documentType = formData.get("documentType") as string;
  const file = formData.get("documentFile");

  if (!memberId) return errorState("Member ID is required.");
  if (!documentType) return errorState("Document type is required.");
  if (!(file instanceof File) || file.size === 0) return errorState("Choose a document to upload.");

  if (!allowedMimeTypes.has(file.type)) {
    return errorState("Upload a JPG, PNG, WebP, or PDF document.");
  }

  if (file.size > maxFileBytes) {
    return errorState("Document must be under 10 MB.");
  }

  const validation = await validateAllowedFile(
    file,
    allowedMimeTypes,
    "Upload a valid JPG, PNG, WebP, or PDF document."
  );

  if (!validation.ok) {
    return errorState(validation.message);
  }

  const supabase = await createSupabaseServerClient();
  let member;
  try {
    member = await requireScopedMember(supabase, memberId, scope);
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate the selected member."));
  }
  const extension = validation.extension;
  const path = `${member.id}/${buildOperationalReference(documentType.toUpperCase())}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("member-documents")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: validation.mimeType,
      upsert: true
    });

  if (uploadError) return errorState(uploadError.message);

  const { error: insertError } = await supabase.from("member_documents").insert({
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    organization_id: scope.scopedOrganizationId ?? scope.organizationId,
    member_id: member.id,
    document_type: documentType,
    file_name: file.name,
    file_path: path,
    file_url: path,
    mime_type: validation.mimeType,
    file_size: file.size,
    uploaded_by: scope.userId
  });

  if (insertError) return errorState(insertError.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "document.upload",
    entityType: "member_document",
    entityId: member.id,
    metadata: {
      documentType,
      fileName: file.name,
      memberCode: member.member_code,
    }
  });

  revalidatePath("/reception/documents");
  return successState("Document uploaded successfully.");
}

export async function deleteDocumentAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/documents");

  const documentId = formData.get("documentId") as string;
  const filePath = formData.get("filePath") as string;

  if (!documentId) return errorState("Document ID is required.");

  const supabase = await createSupabaseServerClient();
  let document;
  try {
    document = await requireScopedDocument(supabase, documentId, scope);
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this document."));
  }

  if (filePath || document.file_path) {
    await supabase.storage.from("member-documents").remove([filePath || document.file_path]);
  }

  const { error } = await supabase
    .from("member_documents")
    .delete()
    .eq("id", documentId)
    .eq("gym_id", scope.gymId)
    .eq("branch_id", scope.branchId);

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "document.delete",
    entityType: "member_document",
    entityId: documentId,
    metadata: {
      memberId: document.member_id,
      documentType: document.document_type,
    }
  });

  revalidatePath("/reception/documents");
  return successState("Document deleted.");
}
