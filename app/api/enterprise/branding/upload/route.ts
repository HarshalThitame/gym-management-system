import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const configId = formData.get("configId") as string | null;
    const type = formData.get("type") as string | null; // "logo" | "favicon"

    if (!file || !configId || !type) {
      return NextResponse.json({ error: "file, configId, and type are required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}. Allowed: PNG, JPEG, SVG, ICO` }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 2MB` }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const raw = supabase as never as {
      from(t: string): {
        select(c: string): { eq(c: string, v: string): { single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
        update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
      };
    };
    const { data: config } = await raw.from("tenant_configs").select("id, organization_id, brand_name").eq("id", configId).single();
    if (!config) return NextResponse.json({ error: "Tenant config not found" }, { status: 404 });

    const fileExt = file.name.split(".").pop() ?? "png";
    const fileName = `${type}-${configId.slice(0, 8)}-${Date.now()}.${fileExt}`;
    const filePath = `branding/${configId}/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("brand-assets").upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });

    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const updateField = type === "logo" ? "logo_url" : "favicon_url";
    const { error: updateError } = await raw.from("tenant_configs").update({ [updateField]: publicUrl }).eq("id", configId);

    if (updateError) return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });

    await writeAuditLog({
      actorId: auth.context.userId,
      action: `branding.${type}_uploaded`,
      entityType: "tenant_config",
      entityId: configId,
      metadata: { fileName, fileSize: file.size, mimeType: file.type, publicUrl },
    });

    return NextResponse.json({ ok: true, url: publicUrl, fileName });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
