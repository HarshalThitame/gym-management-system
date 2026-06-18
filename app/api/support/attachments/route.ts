import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadAttachment } from "@/features/support/services/support-ticket-service";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const ticketId = formData.get("ticketId") as string;

    if (!file || !ticketId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_FIELDS", message: "File and ticketId required." } }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ ok: false, error: { code: "INVALID_TYPE", message: "File type not allowed." } }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: { code: "FILE_TOO_LARGE", message: "File must be under 10MB." } }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `support/tickets/${ticketId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = await supabase.storage.from("attachments").getPublicUrl(storagePath);

    const attachment = await uploadAttachment(ticketId, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
      publicUrl: urlData?.publicUrl ?? undefined,
      uploadedBy: auth.context.userId,
    });

    return NextResponse.json({ ok: true, data: attachment }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "UPLOAD_ERROR", message: e instanceof Error ? e.message : "Failed to upload attachment." } }, { status: 500 });
  }
}
