import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { requireApiFeatureAccess } from "@/features/entitlement";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const organizationId = formData.get("organizationId") as string | null;

    if (!file || !organizationId) {
      return NextResponse.json({ error: "file and organizationId are required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_TYPES.some((t) => file.type.startsWith(t.split("/")[0] + "/"))) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB` }, { status: 400 });
    }

    const denied = await requireApiFeatureAccess(organizationId, "hr_document_storage");
    if (denied) return denied;

    const supabase = await createSupabaseServerClient();

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const filePath = `${organizationId}/${timestamp}-${safeFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("hr-documents").upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });

    const { data: urlData } = supabase.storage.from("hr-documents").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "hr_document.file_uploaded",
      entityType: "hr_documents",
      entityId: null,
      metadata: { fileName: file.name, fileSize: file.size, mimeType: file.type, storagePath: filePath, publicUrl },
    });

    return NextResponse.json({ ok: true, fileUrl: publicUrl, fileName: file.name, fileSize: file.size, contentType: file.type });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
