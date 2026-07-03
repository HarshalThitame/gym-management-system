import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type MemberDocument = Database["public"]["Tables"]["member_documents"]["Row"];

export async function getMemberDocuments(
  memberId: string,
  gymId: string,
  scope?: { branchId?: string | null; organizationId?: string | null }
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("member_documents")
    .select("*")
    .eq("member_id", memberId)
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false });

  if (scope?.branchId) {
    query = query.eq("branch_id", scope.branchId);
  }

  if (scope?.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDocumentUrl(filePath: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase.storage
    .from("member-documents")
    .getPublicUrl(filePath);

  return data.publicUrl;
}
